'use strict';

const mongoose = require('mongoose');

const changeStreamCheckpointSchema = new mongoose.Schema(
  {
    streamId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    collectionName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    resumeToken: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    pipelineVersion: {
      type: String,
      default: 'v1',
      trim: true,
    },
    optionsVersion: {
      type: String,
      default: 'v1',
      trim: true,
    },
    instanceId: {
      type: String,
      default: null,
      trim: true,
    },
    processId: {
      type: Number,
      default: null,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
    collection: 'change_stream_checkpoints',
  }
);

changeStreamCheckpointSchema.index({ collectionName: 1, updatedAt: -1 });

const ChangeStreamCheckpoint =
  mongoose.models.ChangeStreamCheckpoint ||
  mongoose.model('ChangeStreamCheckpoint', changeStreamCheckpointSchema);

module.exports = {
  ChangeStreamCheckpoint,
};
