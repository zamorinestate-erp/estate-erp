'use strict';

const mongoose = require('mongoose');

const sequenceCounterSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    sequenceKey: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      maxlength: 100,
    },

    currentValue: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    prefix: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },

    minimumDigits: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      default: 4,
    },

    lastGeneratedId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    lastGeneratedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'sequence_counters',
  }
);

sequenceCounterSchema.index(
  {
    organisationId: 1,
    sequenceKey: 1,
  },
  {
    unique: true,
    name: 'organisation_sequence_key_unique',
  }
);

sequenceCounterSchema.pre(
  'validate',
  function normalizeSequenceFields() {
    if (this.organisationId) {
      this.organisationId =
        this.organisationId.trim().toUpperCase();
    }

    if (this.sequenceKey) {
      this.sequenceKey =
        this.sequenceKey.trim().toUpperCase();
    }

    if (this.prefix) {
      this.prefix = this.prefix.trim().toUpperCase();
    }
  }
);

sequenceCounterSchema.statics.getNextNumber =
  async function getNextNumber({
    organisationId,
    sequenceKey,
    prefix,
    minimumDigits = 4,
    session = null,
  }) {
    if (!organisationId || !sequenceKey || !prefix) {
      throw new Error(
        'organisationId, sequenceKey and prefix are required.'
      );
    }

    const normalizedOrganisationId =
      organisationId.trim().toUpperCase();

    const normalizedSequenceKey =
      sequenceKey.trim().toUpperCase();

    const normalizedPrefix =
      prefix.trim().toUpperCase();

    const options = {
      returnDocument: 'after',
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    };

    if (session) {
      options.session = session;
    }

    const counter = await this.findOneAndUpdate(
      {
        organisationId: normalizedOrganisationId,
        sequenceKey: normalizedSequenceKey,
      },
      {
        $inc: {
          currentValue: 1,
        },
        $setOnInsert: {
          organisationId: normalizedOrganisationId,
          sequenceKey: normalizedSequenceKey,
          prefix: normalizedPrefix,
          minimumDigits,
        },
        $set: {
          lastGeneratedAt: new Date(),
        },
      },
      options
    );

    if (counter.prefix !== normalizedPrefix) {
      throw new Error(
        `Sequence ${normalizedSequenceKey} is already assigned to prefix ${counter.prefix}.`
      );
    }

    return counter.currentValue;
  };

sequenceCounterSchema.statics.generateId =
  async function generateId({
    organisationId,
    sequenceKey,
    prefix,
    minimumDigits = 4,
    session = null,
  }) {
    const nextNumber = await this.getNextNumber({
      organisationId,
      sequenceKey,
      prefix,
      minimumDigits,
      session,
    });

    const generatedId =
      `${prefix.trim().toUpperCase()}-` +
      String(nextNumber).padStart(minimumDigits, '0');

    const updateOptions = {};

    if (session) {
      updateOptions.session = session;
    }

    await this.updateOne(
      {
        organisationId:
          organisationId.trim().toUpperCase(),
        sequenceKey: sequenceKey.trim().toUpperCase(),
        currentValue: nextNumber,
      },
      {
        $set: {
          lastGeneratedId: generatedId,
          lastGeneratedAt: new Date(),
        },
      },
      updateOptions
    );

    return generatedId;
  };

const SequenceCounter =
  mongoose.models.SequenceCounter ||
  mongoose.model(
    'SequenceCounter',
    sequenceCounterSchema
  );

module.exports = {
  SequenceCounter,
};