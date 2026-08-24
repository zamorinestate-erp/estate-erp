'use strict';

/**
 * MENU SECTION — MONGOOSE MODEL (SCR-013)
 *
 * Defines section groupings within a Menu (e.g. Starters, Mains, Hot Coffees, Cold Brews)
 * and ordered item placements.
 */

const mongoose = require('mongoose');

const itemPlacementSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true, // References canonical MenuItem
    },
    displayOrder: {
      type: Number,
      required: true,
      default: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const menuSectionSchema = new mongoose.Schema(
  {
    sectionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^SEC-\d{4,}$/,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      default: 'ZAMORIN',
      index: true,
    },

    menuId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    displayOrder: {
      type: Number,
      required: true,
      default: 0,
    },

    items: {
      type: [itemPlacementSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'menu_sections',
  }
);

menuSectionSchema.index({ organisationId: 1, menuId: 1, displayOrder: 1 });

const MenuSection = mongoose.models.MenuSection || mongoose.model('MenuSection', menuSectionSchema);

module.exports = {
  MenuSection,
};
