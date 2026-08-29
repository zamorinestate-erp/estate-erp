'use strict';

const mongoose = require('mongoose');
const { ChangeStreamCheckpoint } = require('../models/ChangeStreamCheckpoint');

/**
 * Enterprise Durable Change Stream Checkpoint Service
 * 
 * Provides database-backed, restart-surviving resume token persistence for MongoDB Change Streams.
 * Features:
 * - Precise MongoDB 4.4+ canonical ChangeStreamHistoryLost detection (code 286, codeName: 'ChangeStreamHistoryLost')
 * - Safe differentiation between ordinary resumeAfter vs startAfter (on collection invalidate events)
 * - Pipeline/Options compatibility enforcement (prevents reusing tokens on changed pipeline definitions)
 * - Non-destructive error handling (preserves checkpoints on transient network/cluster errors)
 * - Authoritative security reconciliation hook invocation
 */

class ChangeStreamCheckpointService {
  constructor() {
    this.memoryFallback = new Map();
    this.invalidationHandlers = new Set();
  }

  /**
   * Evaluates whether a MongoDB error strictly represents ChangeStreamHistoryLost (code 286).
   */
  static isChangeStreamHistoryLost(err) {
    if (!err) return false;
    if (err.code === 286 || err.codeName === 'ChangeStreamHistoryLost') {
      return true;
    }
    // Inspect wrapped driver error causes
    if (err.cause && (err.cause.code === 286 || err.cause.codeName === 'ChangeStreamHistoryLost')) {
      return true;
    }
    return false;
  }

  /**
   * Atomically saves or updates a durable resume token checkpoint.
   */
  async saveCheckpoint(streamId, collectionName, resumeToken, metadata = {}) {
    if (!streamId || !collectionName || !resumeToken) {
      throw new Error('streamId, collectionName, and resumeToken are required');
    }

    const instanceId = metadata.instanceId || process.env.INSTANCE_ID || `inst-${process.pid}`;
    const processId = metadata.processId || process.pid;
    const pipelineVersion = metadata.pipelineVersion || 'v1';
    const optionsVersion = metadata.optionsVersion || 'v1';

    const payload = {
      streamId,
      collectionName,
      resumeToken,
      pipelineVersion,
      optionsVersion,
      instanceId,
      processId,
      updatedAt: new Date(),
    };

    // Always update local cache
    this.memoryFallback.set(streamId, payload);

    // Durable MongoDB persistence
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const record = await ChangeStreamCheckpoint.findOneAndUpdate(
          { streamId },
          {
            $set: {
              collectionName,
              resumeToken,
              pipelineVersion,
              optionsVersion,
              instanceId,
              processId,
              updatedAt: new Date(),
            },
            $inc: { version: 1 },
          },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        ).lean();

        return record;
      } catch (err) {
        console.warn(`[ChangeStreamCheckpoint] DB save failed, relying on memory fallback: ${err.message}`);
      }
    }

    return this.memoryFallback.get(streamId);
  }

  /**
   * Loads the durable checkpoint for a given stream.
   */
  async getCheckpoint(streamId) {
    if (!streamId) return null;

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const record = await ChangeStreamCheckpoint.findOne({ streamId }).lean();
        if (record) {
          this.memoryFallback.set(streamId, record);
          return record;
        }
      } catch (err) {
        console.warn(`[ChangeStreamCheckpoint] DB load failed, trying memory fallback: ${err.message}`);
      }
    }

    return this.memoryFallback.get(streamId) || null;
  }

  /**
   * Builds the exact MongoDB Change Stream resume options with pipeline consistency checks.
   */
  async buildResumeOptions(streamId, options = {}) {
    const checkpoint = await this.getCheckpoint(streamId);
    if (!checkpoint || !checkpoint.resumeToken) {
      return { options: {}, hasResumeToken: false, policy: 'INITIAL_START' };
    }

    const expectedPipeline = options.pipelineVersion || 'v1';
    const expectedOptions = options.optionsVersion || 'v1';

    // Verify pipeline and options compatibility
    if (checkpoint.pipelineVersion !== expectedPipeline || checkpoint.optionsVersion !== expectedOptions) {
      console.warn(
        `[ChangeStreamCheckpoint] Stream "${streamId}" definition changed (Stored: p=${checkpoint.pipelineVersion},o=${checkpoint.optionsVersion}; Current: p=${expectedPipeline},o=${expectedOptions}). Discarding incompatible resume token.`
      );
      await this.clearCheckpoint(streamId);
      await this.triggerReconciliation(streamId, new Error('PipelineIncompatible'));
      return { options: {}, hasResumeToken: false, policy: 'PIPELINE_MISMATCH_RESTART' };
    }

    // Invalidate events (drop/rename) require startAfter instead of resumeAfter
    if (options.isInvalidateEvent) {
      return {
        options: { startAfter: checkpoint.resumeToken },
        hasResumeToken: true,
        policy: 'START_AFTER_INVALIDATE',
      };
    }

    return {
      options: { resumeAfter: checkpoint.resumeToken },
      hasResumeToken: true,
      policy: 'RESUME_AFTER_STANDARD',
    };
  }

  /**
   * Handles stream errors with strict differentiation between History Loss vs Unrelated Transient Errors.
   */
  async handleStreamError(streamId, err) {
    const isHistoryLoss = ChangeStreamCheckpointService.isChangeStreamHistoryLost(err);

    if (isHistoryLoss) {
      console.warn(
        `[ChangeStreamCheckpoint] Canonical ChangeStreamHistoryLost (code ${err?.code || 286}) on stream "${streamId}". Removing stale checkpoint and reconciling authoritative state.`
      );

      await this.clearCheckpoint(streamId);
      await this.triggerReconciliation(streamId, err);

      return {
        isHistoryLost: true,
        action: 'FALLBACK_REOPEN_CURRENT',
        resumeFromCurrent: true,
        staleTokenRemoved: true,
      };
    }

    // Unrelated transient errors (network, timeout) — DO NOT destructively delete checkpoint
    console.warn(
      `[ChangeStreamCheckpoint] Transient/Unrelated stream error on "${streamId}" (code ${err?.code || 'UNKNOWN'}). Checkpoint preserved for retry.`
    );

    return {
      isHistoryLost: false,
      action: 'RETRY_WITH_EXISTING_TOKEN',
      resumeFromCurrent: false,
      staleTokenRemoved: false,
    };
  }

  /**
   * Cleans a specific checkpoint.
   */
  async clearCheckpoint(streamId) {
    this.memoryFallback.delete(streamId);
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        await ChangeStreamCheckpoint.deleteOne({ streamId });
      } catch (_) {}
    }
  }

  /**
   * Triggers registered security reconciliation handlers.
   */
  async triggerReconciliation(streamId, err) {
    for (const handler of this.invalidationHandlers) {
      try {
        await handler(streamId, err);
      } catch (recErr) {
        console.error(`[ChangeStreamCheckpoint] Reconciliation handler error: ${recErr.message}`);
      }
    }
  }

  /**
   * Registers a security reconciliation handler to run when stream tokens become invalid.
   */
  onInvalidTokenReconcile(handler) {
    if (typeof handler === 'function') {
      this.invalidationHandlers.add(handler);
    }
  }

  /**
   * Clears all checkpoints (for testing).
   */
  async reset() {
    this.memoryFallback.clear();
    this.invalidationHandlers.clear();
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        await ChangeStreamCheckpoint.deleteMany({});
      } catch (_) {}
    }
  }
}

const defaultCheckpointService = new ChangeStreamCheckpointService();

module.exports = {
  ChangeStreamCheckpointService,
  changeStreamCheckpointService: defaultCheckpointService,
};
