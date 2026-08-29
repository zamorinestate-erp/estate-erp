'use strict';

const EventEmitter = require('node:events');

/**
 * Enterprise Distributed Event Bus & Realtime Broker
 * 
 * Supports:
 * - Shared pub/sub across multi-instance cluster (Redis Pub/Sub adapter or internal EventEmitter)
 * - Cross-instance security events (Device revocation, Session termination, Forced logout)
 * - Single-subscription Mongo Change Stream fan-out (prevents per-socket change stream exhaustion)
 * - Resume token tracking and reconnect resilience
 */

class DistributedEventBus extends EventEmitter {
  constructor(options = {}) {
    super();
    this.redisPublisher = options.redisPublisher || null;
    this.redisSubscriber = options.redisSubscriber || null;
    this.isDistributed = Boolean(this.redisPublisher && this.redisSubscriber);
    this.subscribers = new Map(); // topic -> Set(callbacks)
    this.resumeTokens = new Map(); // collectionName -> token
    this.metrics = {
      publishedEvents: 0,
      deliveredEvents: 0,
      crossInstanceEvents: 0,
    };
  }

  setRedisBrokers(publisher, subscriber) {
    this.redisPublisher = publisher;
    this.redisSubscriber = subscriber;
    this.isDistributed = Boolean(publisher && subscriber);

    if (this.isDistributed && this.redisSubscriber) {
      this.redisSubscriber.on('message', (channel, messageStr) => {
        try {
          const payload = JSON.parse(messageStr);
          this.metrics.crossInstanceEvents++;
          this.emitLocal(channel, payload);
        } catch (_) {}
      });
    }
  }

  /**
   * Publishes an event to both local listeners and distributed subscribers.
   */
  async publish(topic, payload) {
    this.metrics.publishedEvents++;
    const eventEnvelope = {
      topic,
      payload,
      timestamp: new Date().toISOString(),
      sourceInstanceId: process.env.INSTANCE_ID || `inst-${process.pid}`,
    };

    // Deliver locally
    this.emitLocal(topic, eventEnvelope);

    // Broadcast across cluster if distributed
    if (this.isDistributed && this.redisPublisher) {
      try {
        await this.redisPublisher.publish(topic, JSON.stringify(eventEnvelope));
      } catch (err) {
        console.warn(`[EventBus] Distributed publish failed: ${err.message}`);
      }
    }

    return eventEnvelope;
  }

  /**
   * Subscribes to an event topic.
   */
  subscribe(topic, callback) {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
      if (this.isDistributed && this.redisSubscriber) {
        this.redisSubscriber.subscribe(topic).catch(() => {});
      }
    }
    this.subscribers.get(topic).add(callback);

    return () => this.unsubscribe(topic, callback);
  }

  /**
   * Unsubscribes from an event topic.
   */
  unsubscribe(topic, callback) {
    if (this.subscribers.has(topic)) {
      this.subscribers.get(topic).delete(callback);
      if (this.subscribers.get(topic).size === 0) {
        this.subscribers.delete(topic);
        if (this.isDistributed && this.redisSubscriber) {
          this.redisSubscriber.unsubscribe(topic).catch(() => {});
        }
      }
    }
  }

  emitLocal(topic, eventEnvelope) {
    this.emit(topic, eventEnvelope);
    if (this.subscribers.has(topic)) {
      for (const cb of this.subscribers.get(topic)) {
        try {
          cb(eventEnvelope.payload, eventEnvelope);
          this.metrics.deliveredEvents++;
        } catch (err) {
          console.error(`[EventBus] Callback error on topic "${topic}":`, err.message);
        }
      }
    }
  }

  /**
   * Saves latest resume token for MongoDB change streams.
   */
  saveResumeToken(collectionName, token) {
    this.resumeTokens.set(collectionName, token);
  }

  getResumeToken(collectionName) {
    return this.resumeTokens.get(collectionName) || null;
  }

  getMetrics() {
    return {
      ...this.metrics,
      activeTopicsCount: this.subscribers.size,
      isDistributed: this.isDistributed,
    };
  }

  reset() {
    this.subscribers.clear();
    this.resumeTokens.clear();
    this.metrics = {
      publishedEvents: 0,
      deliveredEvents: 0,
      crossInstanceEvents: 0,
    };
  }
}

const defaultEventBus = new DistributedEventBus();

module.exports = {
  DistributedEventBus,
  defaultEventBus,
};
