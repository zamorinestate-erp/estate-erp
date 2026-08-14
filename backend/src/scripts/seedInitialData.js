'use strict';

require('dotenv').config({
  quiet: true,
});

const {
  connectDatabase,
  disconnectDatabase,
} = require('../config/database');

const {
  loadEnvironment,
} = require('../config/environment');

const {
  User,
} = require('../models/User');

const {
  RolePermission,
} = require('../models/RolePermission');

const {
  SequenceCounter,
} = require('../models/SequenceCounter');

const {
  hashPassword,
} = require('../services/authService');

function requireEnvironmentValue(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(
      `${name} is required.`
    );
  }

  return value.trim();
}

function normalizeIdentifier(value) {
  return value
    .trim()
    .toUpperCase();
}

function normalizeEmail(value) {
  return value
    .trim()
    .toLowerCase();
}

const DEFAULT_PERMISSION_RULES = [
  {
    role: 'MASTER',
    permissionCode: 'CAFE:MANAGE',
    module: 'CAFE',
    resource: 'CAFE',
    action: 'MANAGE',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    description:
      'MASTER may manage cafÃ©s across the organisation.',
  },
  {
    role: 'MASTER',
    permissionCode: 'USER:MANAGE',
    module: 'USER',
    resource: 'USER',
    action: 'MANAGE',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    requiresStepUpAuthentication: true,
    requiresReason: true,
    requiresAuditEvent: true,
    requiresReauthentication: false,
    description:
      'MASTER may manage organisation users.',
  },
  {
    role: 'MASTER',
    permissionCode: 'EMPLOYEE:READ',
    module: 'EMPLOYEE',
    resource: 'EMPLOYEE',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    requiresAuditEvent: false,
    description:
      'MASTER may read organisation employee records.',
  },
  {
    role: 'MASTER',
    permissionCode: 'AUDIT:READ',
    module: 'AUDIT',
    resource: 'AUDIT_EVENT',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    description:
      'MASTER may read organisation audit events.',
  },
  {
    role: 'MASTER',
    permissionCode: 'PERSONAL_LEDGER_READ',
    module: 'PERSONAL_LEDGER',
    resource: 'PERSONAL_LEDGER_ENTRY',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    requiresAuditEvent: false,
    description: 'MASTER may read their own Personal Ledger.',
  },
  {
    role: 'MASTER',
    permissionCode: 'PERSONAL_LEDGER_WRITE',
    module: 'PERSONAL_LEDGER',
    resource: 'PERSONAL_LEDGER_ENTRY',
    action: 'WRITE',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    requiresReason: true,
    requiresAuditEvent: true,
    description: 'MASTER may write to their own Personal Ledger.',
  },
  {
    role: 'OWNER',
    permissionCode: 'PERSONAL_LEDGER_READ',
    module: 'PERSONAL_LEDGER',
    resource: 'PERSONAL_LEDGER_ENTRY',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    requiresAuditEvent: false,
    description: 'OWNER may read their own Personal Ledger.',
  },
  {
    role: 'OWNER',
    permissionCode: 'PERSONAL_LEDGER_WRITE',
    module: 'PERSONAL_LEDGER',
    resource: 'PERSONAL_LEDGER_ENTRY',
    action: 'WRITE',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    requiresReason: true,
    requiresAuditEvent: true,
    description: 'OWNER may write to their own Personal Ledger.',
  },
  {
    role: 'OWNER',
    permissionCode: 'CAFE:READ',
    module: 'CAFE',
    resource: 'CAFE',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    description:
      'OWNER may read organisation cafÃ© information.',
  },
  {
    role: 'OWNER',
    permissionCode: 'USER:READ',
    module: 'USER',
    resource: 'USER',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    description:
      'OWNER may read organisation user information.',
  },
  {
    role: 'OWNER',
    permissionCode: 'EMPLOYEE:READ',
    module: 'EMPLOYEE',
    resource: 'EMPLOYEE',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    requiresAuditEvent: false,
    description:
      'OWNER may read organisation employee records.',
  },
  {
    role: 'CAFE_ADMIN',
    permissionCode: 'CAFE:READ',
    module: 'CAFE',
    resource: 'CAFE',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ASSIGNED_CAFES',
    requiresMfa: true,
    description:
      'CafÃ© Admin may read assigned cafÃ© information.',
  },
  {
    role: 'CAFE_ADMIN',
    permissionCode: 'USER:READ',
    module: 'USER',
    resource: 'USER',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ASSIGNED_CAFES',
    requiresMfa: true,
    description:
      'CafÃ© Admin may read users in assigned cafÃ©s.',
  },
  {
    role: 'CAFE_ADMIN',
    permissionCode: 'EMPLOYEE:READ',
    module: 'EMPLOYEE',
    resource: 'EMPLOYEE',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'RECORD',
    requiresMfa: true,
    requiresAuditEvent: false,
    description:
      'Cafe Admin may read active employee records in assigned cafes.',
  },
 { role: 'MASTER', permissionCode: 'POS_READ', module: 'POS_BILLING', resource: 'BILL', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'MASTER', permissionCode: 'POS_WRITE', module: 'POS_BILLING', resource: 'BILL', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: true },
 { role: 'MASTER', permissionCode: 'POS_VOID', module: 'POS_BILLING', resource: 'BILL', action: 'VOID', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresReason: true, requiresAuditEvent: true },
  { role: 'OWNER', permissionCode: 'POS_READ', module: 'POS_BILLING', resource: 'BILL', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'OWNER', permissionCode: 'POS_VOID', module: 'POS_BILLING', resource: 'BILL', action: 'VOID', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresReason: true, requiresAuditEvent: true },
 { role: 'CAFE_ADMIN', permissionCode: 'POS_READ', module: 'POS_BILLING', resource: 'BILL', action: 'READ', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: false },
 { role: 'CAFE_ADMIN', permissionCode: 'POS_WRITE', module: 'POS_BILLING', resource: 'BILL', action: 'WRITE', effect: 'ALLOW', scope: 'ASSIGNED_CAFES', requiresMfa: true, requiresAuditEvent: true },
  { role: 'MASTER', permissionCode: 'INVENTORY_READ', module: 'INVENTORY', resource: 'INVENTORY', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'MASTER', permissionCode: 'INVENTORY_WRITE', module: 'INVENTORY', resource: 'INVENTORY', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: true },
  { role: 'OWNER', permissionCode: 'INVENTORY_READ', module: 'INVENTORY', resource: 'INVENTORY', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'CAFE_ADMIN', permissionCode: 'INVENTORY_READ', module: 'INVENTORY', resource: 'INVENTORY', action: 'READ', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: false },
  { role: 'CAFE_ADMIN', permissionCode: 'INVENTORY_WRITE', module: 'INVENTORY', resource: 'INVENTORY', action: 'WRITE', effect: 'ALLOW', scope: 'ASSIGNED_CAFES', requiresMfa: true, requiresAuditEvent: true },
  { role: 'MASTER', permissionCode: 'VENDORS_READ', module: 'VENDORS', resource: 'VENDOR', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'MASTER', permissionCode: 'VENDORS_WRITE', module: 'VENDORS', resource: 'VENDOR', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: true },
  { role: 'OWNER', permissionCode: 'VENDORS_READ', module: 'VENDORS', resource: 'VENDOR', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'CAFE_ADMIN', permissionCode: 'VENDORS_READ', module: 'VENDORS', resource: 'VENDOR', action: 'READ', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: false },
  { role: 'MASTER', permissionCode: 'MENU_READ', module: 'MENU', resource: 'MENU_ITEM', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'MASTER', permissionCode: 'MENU_WRITE', module: 'MENU', resource: 'MENU_ITEM', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: true },
  { role: 'OWNER', permissionCode: 'MENU_READ', module: 'MENU', resource: 'MENU_ITEM', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'CAFE_ADMIN', permissionCode: 'MENU_READ', module: 'MENU', resource: 'MENU_ITEM', action: 'READ', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: false },
  { role: 'MASTER', permissionCode: 'APPROVALS_READ', module: 'APPROVALS', resource: 'APPROVAL', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'MASTER', permissionCode: 'APPROVALS_DECIDE', module: 'APPROVALS', resource: 'APPROVAL', action: 'DECIDE', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: true },
  { role: 'OWNER', permissionCode: 'APPROVALS_READ', module: 'APPROVALS', resource: 'APPROVAL', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'OWNER', permissionCode: 'APPROVALS_DECIDE', module: 'APPROVALS', resource: 'APPROVAL', action: 'DECIDE', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: true },
  { role: 'CAFE_ADMIN', permissionCode: 'APPROVALS_READ', module: 'APPROVALS', resource: 'APPROVAL', action: 'READ', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: false },
  { role: 'CAFE_ADMIN', permissionCode: 'APPROVALS_DECIDE', module: 'APPROVALS', resource: 'APPROVAL', action: 'DECIDE', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: true },
  { role: 'MASTER', permissionCode: 'ASSETS_READ', module: 'ASSETS', resource: 'ASSET', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'MASTER', permissionCode: 'ASSETS_WRITE', module: 'ASSETS', resource: 'ASSET', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: true },
  { role: 'OWNER', permissionCode: 'ASSETS_READ', module: 'ASSETS', resource: 'ASSET', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'CAFE_ADMIN', permissionCode: 'ASSETS_READ', module: 'ASSETS', resource: 'ASSET', action: 'READ', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: false },
  { role: 'CAFE_ADMIN', permissionCode: 'ASSETS_WRITE', module: 'ASSETS', resource: 'ASSET', action: 'WRITE', effect: 'ALLOW', scope: 'ASSIGNED_CAFES', requiresMfa: true, requiresAuditEvent: true },
  { role: 'MASTER', permissionCode: 'CUSTOMERS_READ', module: 'CUSTOMERS', resource: 'CUSTOMER', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'MASTER', permissionCode: 'CUSTOMERS_WRITE', module: 'CUSTOMERS', resource: 'CUSTOMER', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: true },
  { role: 'OWNER', permissionCode: 'CUSTOMERS_READ', module: 'CUSTOMERS', resource: 'CUSTOMER', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'CAFE_ADMIN', permissionCode: 'CUSTOMERS_READ', module: 'CUSTOMERS', resource: 'CUSTOMER', action: 'READ', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: false },
  { role: 'CAFE_ADMIN', permissionCode: 'CUSTOMERS_WRITE', module: 'CUSTOMERS', resource: 'CUSTOMER', action: 'WRITE', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: true },
  { role: 'MASTER', permissionCode: 'DEPARTMENT_ORDERS_READ', module: 'DEPARTMENT_ORDERS', resource: 'DEPARTMENT_ORDER', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'MASTER', permissionCode: 'DEPARTMENT_ORDERS_WRITE', module: 'DEPARTMENT_ORDERS', resource: 'DEPARTMENT_ORDER', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: true },
  { role: 'OWNER', permissionCode: 'DEPARTMENT_ORDERS_READ', module: 'DEPARTMENT_ORDERS', resource: 'DEPARTMENT_ORDER', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'CAFE_ADMIN', permissionCode: 'DEPARTMENT_ORDERS_READ', module: 'DEPARTMENT_ORDERS', resource: 'DEPARTMENT_ORDER', action: 'READ', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: false },
  { role: 'CAFE_ADMIN', permissionCode: 'DEPARTMENT_ORDERS_WRITE', module: 'DEPARTMENT_ORDERS', resource: 'DEPARTMENT_ORDER', action: 'WRITE', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: true },
  { role: 'MASTER', permissionCode: 'PROCUREMENT_READ', module: 'PROCUREMENT', resource: 'PURCHASE_ORDER', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'MASTER', permissionCode: 'PROCUREMENT_WRITE', module: 'PROCUREMENT', resource: 'PURCHASE_ORDER', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: true },
  { role: 'MASTER', permissionCode: 'PROCUREMENT_APPROVE', module: 'PROCUREMENT', resource: 'PURCHASE_ORDER', action: 'APPROVE', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: true },
  { role: 'MASTER', permissionCode: 'PROCUREMENT_RECEIVE', module: 'PROCUREMENT', resource: 'PURCHASE_ORDER', action: 'RECEIVE', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: true },
  { role: 'OWNER', permissionCode: 'PROCUREMENT_READ', module: 'PROCUREMENT', resource: 'PURCHASE_ORDER', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: false },
  { role: 'OWNER', permissionCode: 'PROCUREMENT_WRITE', module: 'PROCUREMENT', resource: 'PURCHASE_ORDER', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresReason: true, requiresAuditEvent: true },
  { role: 'OWNER', permissionCode: 'PROCUREMENT_APPROVE', module: 'PROCUREMENT', resource: 'PURCHASE_ORDER', action: 'APPROVE', effect: 'ALLOW', scope: 'ORGANISATION', requiresMfa: true, requiresAuditEvent: true },
  { role: 'CAFE_ADMIN', permissionCode: 'PROCUREMENT_READ', module: 'PROCUREMENT', resource: 'PURCHASE_ORDER', action: 'READ', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: false },
  { role: 'CAFE_ADMIN', permissionCode: 'PROCUREMENT_WRITE', module: 'PROCUREMENT', resource: 'PURCHASE_ORDER', action: 'WRITE', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: true },
  { role: 'CAFE_ADMIN', permissionCode: 'PROCUREMENT_APPROVE', module: 'PROCUREMENT', resource: 'PURCHASE_ORDER', action: 'APPROVE', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: true },
  { role: 'CAFE_ADMIN', permissionCode: 'PROCUREMENT_RECEIVE', module: 'PROCUREMENT', resource: 'PURCHASE_ORDER', action: 'RECEIVE', effect: 'ALLOW', scope: 'RECORD', requiresMfa: true, requiresAuditEvent: true },
  {
    role: 'STAFF',
    permissionCode: 'USER:READ_SELF',
    module: 'USER',
    resource: 'USER',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'SELF',
    requiresMfa: false,
    description:
      'Staff may read their own user information.',
  },
  {
    role: 'STAFF',
    permissionCode: 'EMPLOYEE:READ_SELF',
    module: 'EMPLOYEE',
    resource: 'EMPLOYEE',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'SELF',
    requiresMfa: false,
    requiresAuditEvent: false,
    description:
      'Staff may read only their own employee record.',
  },
  {
    role: 'STAFF',
    permissionCode: 'NOTIFICATION:READ_SELF',
    module: 'NOTIFICATION',
    resource: 'NOTIFICATION',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'SELF',
    requiresMfa: false,
    description:
      'Staff may read their own notifications.',
  },
  {
    role: 'MASTER',
    permissionCode: 'ADMIN',
    module: 'ADMINISTRATION',
    resource: 'CUSTOM_FIELDS',
    action: 'MANAGE',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    description: 'MASTER may manage organisation custom field definitions.',
  },
  {
    role: 'OWNER',
    permissionCode: 'ADMIN',
    module: 'ADMINISTRATION',
    resource: 'CUSTOM_FIELDS',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: false,
    description: 'OWNER may read organisation custom field definitions.',
  },
  {
    role: 'CAFE_ADMIN',
    permissionCode: 'ADMIN',
    module: 'ADMINISTRATION',
    resource: 'CUSTOM_FIELDS',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ASSIGNED_CAFES',
    requiresMfa: false,
    description: 'CAFE_ADMIN may read organisation custom field definitions.',
  },
  {
    role: 'STAFF',
    permissionCode: 'ADMIN',
    module: 'ADMINISTRATION',
    resource: 'CUSTOM_FIELDS',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'SELF',
    requiresMfa: false,
    description: 'STAFF may read custom field definitions for self forms.',
  },
  // Quality & Compliance
  { role: 'MASTER', permissionCode: 'QUALITY_READ', module: 'QUALITY', resource: 'CHECKLIST', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', description: 'MASTER may read quality checklists.' },
  { role: 'OWNER', permissionCode: 'QUALITY_READ', module: 'QUALITY', resource: 'CHECKLIST', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', description: 'OWNER may read quality checklists.' },
  { role: 'CAFE_ADMIN', permissionCode: 'QUALITY_READ', module: 'QUALITY', resource: 'CHECKLIST', action: 'READ', effect: 'ALLOW', scope: 'ASSIGNED_CAFES', description: 'CAFE_ADMIN may read quality checklists.' },
  { role: 'STAFF', permissionCode: 'QUALITY_READ', module: 'QUALITY', resource: 'CHECKLIST', action: 'READ', effect: 'ALLOW', scope: 'ASSIGNED_CAFES', description: 'STAFF may read quality checklists.' },
  { role: 'MASTER', permissionCode: 'QUALITY_WRITE', module: 'QUALITY', resource: 'CHECKLIST', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', description: 'MASTER may submit quality checklists.' },
  { role: 'CAFE_ADMIN', permissionCode: 'QUALITY_WRITE', module: 'QUALITY', resource: 'CHECKLIST', action: 'WRITE', effect: 'ALLOW', scope: 'ASSIGNED_CAFES', description: 'CAFE_ADMIN may submit quality checklists.' },
  { role: 'STAFF', permissionCode: 'QUALITY_WRITE', module: 'QUALITY', resource: 'CHECKLIST', action: 'WRITE', effect: 'ALLOW', scope: 'ASSIGNED_CAFES', description: 'STAFF may submit quality checklists.' },
  // Revenue Share
  { role: 'MASTER', permissionCode: 'REVENUE_SHARE_READ', module: 'REVENUE_SHARE', resource: 'AGREEMENT', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', description: 'MASTER may read revenue share agreements.' },
  { role: 'OWNER', permissionCode: 'REVENUE_SHARE_READ', module: 'REVENUE_SHARE', resource: 'AGREEMENT', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', description: 'OWNER may read revenue share agreements.' },
  { role: 'MASTER', permissionCode: 'REVENUE_SHARE_WRITE', module: 'REVENUE_SHARE', resource: 'AGREEMENT', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', description: 'MASTER may create revenue share agreements.' },
  // Tasks
  { role: 'MASTER', permissionCode: 'TASKS_READ', module: 'TASKS', resource: 'TASK', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', description: 'MASTER may read tasks.' },
  { role: 'OWNER', permissionCode: 'TASKS_READ', module: 'TASKS', resource: 'TASK', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', description: 'OWNER may read tasks.' },
  { role: 'CAFE_ADMIN', permissionCode: 'TASKS_READ', module: 'TASKS', resource: 'TASK', action: 'READ', effect: 'ALLOW', scope: 'ASSIGNED_CAFES', description: 'CAFE_ADMIN may read tasks.' },
  { role: 'STAFF', permissionCode: 'TASKS_READ', module: 'TASKS', resource: 'TASK', action: 'READ', effect: 'ALLOW', scope: 'SELF', description: 'STAFF may read own tasks.' },
  { role: 'MASTER', permissionCode: 'TASKS_WRITE', module: 'TASKS', resource: 'TASK', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', description: 'MASTER may manage tasks.' },
  { role: 'OWNER', permissionCode: 'TASKS_WRITE', module: 'TASKS', resource: 'TASK', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', description: 'OWNER may manage tasks.' },
  { role: 'CAFE_ADMIN', permissionCode: 'TASKS_WRITE', module: 'TASKS', resource: 'TASK', action: 'WRITE', effect: 'ALLOW', scope: 'ASSIGNED_CAFES', description: 'CAFE_ADMIN may manage tasks.' },
  { role: 'STAFF', permissionCode: 'TASKS_WRITE', module: 'TASKS', resource: 'TASK', action: 'WRITE', effect: 'ALLOW', scope: 'SELF', description: 'STAFF may update own task status.' },
  // Trash Bin
  { role: 'MASTER', permissionCode: 'TRASH_READ', module: 'TRASH', resource: 'TRASH_ITEM', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', description: 'MASTER may read trash items.' },
  { role: 'MASTER', permissionCode: 'TRASH_RESTORE', module: 'TRASH', resource: 'TRASH_ITEM', action: 'RESTORE', effect: 'ALLOW', scope: 'ORGANISATION', description: 'MASTER may restore trash items.' },
  // Dashboard
  { role: 'MASTER', permissionCode: 'DASHBOARD_READ', module: 'DASHBOARD', resource: 'DASHBOARD', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', description: 'MASTER may read dashboard.' },
  { role: 'OWNER', permissionCode: 'DASHBOARD_READ', module: 'DASHBOARD', resource: 'DASHBOARD', action: 'READ', effect: 'ALLOW', scope: 'ORGANISATION', description: 'OWNER may read dashboard.' },
  { role: 'CAFE_ADMIN', permissionCode: 'DASHBOARD_READ', module: 'DASHBOARD', resource: 'DASHBOARD', action: 'READ', effect: 'ALLOW', scope: 'ASSIGNED_CAFES', description: 'CAFE_ADMIN may read dashboard.' },
  { role: 'STAFF', permissionCode: 'DASHBOARD_READ', module: 'DASHBOARD', resource: 'DASHBOARD', action: 'READ', effect: 'ALLOW', scope: 'SELF', description: 'STAFF may read dashboard.' },
  // Employee Write
  { role: 'MASTER', permissionCode: 'EMPLOYEE:WRITE', module: 'EMPLOYEE', resource: 'EMPLOYEE', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', description: 'MASTER may update employee records.' },
  { role: 'OWNER', permissionCode: 'EMPLOYEE:WRITE', module: 'EMPLOYEE', resource: 'EMPLOYEE', action: 'WRITE', effect: 'ALLOW', scope: 'ORGANISATION', description: 'OWNER may update employee records.' },
];

const PRIMARY_MASTER_DESIGNATION_REASON =
  'Initial Primary Master designation during secure bootstrap.';

function assertPrimaryMasterCandidate({
  user,
  organisationId,
}) {
  if (!user) {
    throw new Error(
      'A Primary Master candidate is required.'
    );
  }

  if (
    user.organisationId !== organisationId
  ) {
    throw new Error(
      'The Primary Master candidate belongs to a different organisation.'
    );
  }

  if (user.role !== 'MASTER') {
    throw new Error(
      'The Primary Master candidate must have the MASTER role.'
    );
  }

  if (user.accountStatus !== 'ACTIVE') {
    throw new Error(
      'The Primary Master candidate must have an ACTIVE account.'
    );
  }

  if (
    user.primaryCafeId ||
    (user.assignedCafeIds || []).length > 0
  ) {
    throw new Error(
      'The Primary Master candidate cannot be restricted to cafÃ© assignments.'
    );
  }
}

async function seedMasterUser({
  organisationId,
  masterName,
  masterEmail,
  masterPassword,
}) {
  const existingPrimaryMasters =
    await User.find({
      organisationId,
      isPrimaryMaster: true,
    }).sort({
      createdAt: 1,
      userId: 1,
    });

  if (
    existingPrimaryMasters.length > 1
  ) {
    throw new Error(
      'Multiple Primary Master accounts exist for this organisation.'
    );
  }

  if (
    existingPrimaryMasters.length === 1
  ) {
    const primaryMaster =
      existingPrimaryMasters[0];

    assertPrimaryMasterCandidate({
      user: primaryMaster,
      organisationId,
    });

    await primaryMaster.validate();

    console.log(
      `Primary MASTER already exists: ${primaryMaster.userId}`
    );

    return primaryMaster;
  }

  const existingMasters =
    await User.find({
      organisationId,
      role: 'MASTER',
      accountStatus: {
        $ne: 'ARCHIVED',
      },
    }).sort({
      createdAt: 1,
      userId: 1,
    });

  if (existingMasters.length > 1) {
    throw new Error(
      'Multiple MASTER accounts exist and no Primary Master can be selected automatically.'
    );
  }

  if (existingMasters.length === 1) {
    const legacyMaster =
      existingMasters[0];

    assertPrimaryMasterCandidate({
      user: legacyMaster,
      organisationId,
    });

    const designatedAt = new Date();

    const designationResult =
      await User.collection.updateOne(
        {
          _id: legacyMaster._id,
          organisationId,
          role: 'MASTER',
          accountStatus: 'ACTIVE',
          isPrimaryMaster: {
            $ne: true,
          },
        },
        {
          $set: {
            isPrimaryMaster: true,
            primaryMasterDesignatedAt:
              designatedAt,
            primaryMasterDesignatedBy:
              legacyMaster.userId,
            primaryMasterDesignationReason:
              PRIMARY_MASTER_DESIGNATION_REASON,
            updatedBy:
              legacyMaster.userId,
          },
          $push: {
            roleHistory: {
              toRole: 'MASTER',
              changedAt:
                designatedAt,
              changedBy:
                legacyMaster.userId,
              reason:
                PRIMARY_MASTER_DESIGNATION_REASON,
              correlationId: null,
              sessionId: null,
            },
          },
        }
      );

    if (
      designationResult.matchedCount !== 1 ||
      designationResult.modifiedCount !== 1
    ) {
      throw new Error(
        'The existing MASTER could not be designated as Primary Master.'
      );
    }

    const primaryMaster =
      await User.findById(
        legacyMaster._id
      );

    assertPrimaryMasterCandidate({
      user: primaryMaster,
      organisationId,
    });

    await primaryMaster.validate();

    console.log(
      `Designated existing MASTER as Primary Master: ${primaryMaster.userId}`
    );

    return primaryMaster;
  }

  const duplicateEmail =
    await User.findOne({
      organisationId,
      email: masterEmail,
    });

  if (duplicateEmail) {
    throw new Error(
      'The MASTER email is already used by another user.'
    );
  }

  const userId =
    await SequenceCounter.generateId({
      organisationId,
      sequenceKey: 'USER_MASTER',
      prefix: 'MU',
      minimumDigits: 4,
    });

  const passwordHash =
    await hashPassword(
      masterPassword
    );

  const designatedAt = new Date();

  const masterUser =
    await User.create({
      userId,
      organisationId,
      name: masterName,
      preferredName: '',
      email: masterEmail,
      phone: '',
      role: 'MASTER',
      accountStatus: 'ACTIVE',
      primaryCafeId: null,
      assignedCafeIds: [],
      isPrimaryMaster: true,
      primaryMasterDesignatedAt:
        designatedAt,
      primaryMasterDesignatedBy:
        userId,
      primaryMasterDesignationReason:
        PRIMARY_MASTER_DESIGNATION_REASON,
      roleHistory: [
        {
          toRole: 'MASTER',
          changedAt:
            designatedAt,
          changedBy:
            userId,
          reason:
            PRIMARY_MASTER_DESIGNATION_REASON,
          correlationId: null,
          sessionId: null,
        },
      ],
      cafeAssignmentHistory: [],
      passwordHash,
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      mfaEnabled: false,
      mfaMethod: 'NONE',
      preferredLanguage: 'en',
      timezone: 'Asia/Kolkata',
      createdBy: userId,
      updatedBy: userId,
    });

  console.log(
    `Created Primary MASTER user: ${masterUser.userId}`
  );

  return masterUser;
}

async function seedPermissionRules({
  organisationId,
  masterUserId,
}) {
  let createdCount = 0;
  let existingCount = 0;

  for (
    const rule of
    DEFAULT_PERMISSION_RULES
  ) {
    const existingRule =
      await RolePermission.findOne({
        organisationId,
        role: rule.role,
        cafeId: null,
        permissionCode:
          rule.permissionCode,
        isActive: true,
        archivedAt: null,
      });

    if (existingRule) {
      const desiredProperties = {
        scope: rule.scope,
        module: rule.module,
        resource: rule.resource,
        action: rule.action,
        effect: rule.effect,
        description: rule.description,
        requiresMfa: Boolean(rule.requiresMfa),
        requiresStepUpAuthentication: Boolean(rule.requiresStepUpAuthentication),
        requiresReason: Boolean(rule.requiresReason),
        requiresAuditEvent: rule.requiresAuditEvent !== false,
        requiresReauthentication: Boolean(rule.requiresReauthentication),
      };

      let ruleChanged = false;

      for (const [field, value] of Object.entries(desiredProperties)) {
        if (existingRule[field] !== undefined && existingRule[field] !== value) {
          existingRule[field] = value;
          ruleChanged = true;
        }
      }

      if (ruleChanged) {
        existingRule.updatedBy = masterUserId;
        existingRule.policyVersion = Number.isInteger(existingRule.policyVersion)
          ? existingRule.policyVersion + 1
          : 1;

        await existingRule.save();
      }

      existingCount += 1;
      continue;
    }

    const permissionRuleId =
      await SequenceCounter.generateId({
        organisationId,
        sequenceKey:
          'PERMISSION_RULE',
        prefix: 'PR',
        minimumDigits: 4,
      });

    await RolePermission.create({
      permissionRuleId,
      organisationId,
      role: rule.role,
      cafeId: null,
      permissionCode:
        rule.permissionCode,
      module: rule.module,
      resource: rule.resource,
      action: rule.action,
      effect: rule.effect,
      scope: rule.scope,
      fieldAccess: {
        allowedFields: [],
        deniedFields: [],
        maskedFields: [],
      },
      conditions: {},
      requiresMfa:
        rule.requiresMfa,
      requiresStepUpAuthentication:
        Boolean(
          rule
            .requiresStepUpAuthentication
        ),
      requiresReason:
        Boolean(rule.requiresReason),
      requiresAuditEvent:
        rule.requiresAuditEvent !== false,
      requiresReauthentication:
        Boolean(
          rule.requiresReauthentication
        ),
      isDelegable: false,
      isActive: true,
      effectiveFrom: new Date(),
      effectiveTo: null,
      description:
        rule.description,
      policyVersion: 1,
      createdBy:
        masterUserId,
      updatedBy:
        masterUserId,
    });

    createdCount += 1;
  }

  console.log(
    `Permission rules created: ${createdCount}`
  );

  console.log(
    `Permission rules already existing: ${existingCount}`
  );
}

async function runSeed() {
  try {
    const environment =
      loadEnvironment();

    const organisationId =
      normalizeIdentifier(
        requireEnvironmentValue(
          'INITIAL_ORGANISATION_ID'
        )
      );

    const masterName =
      requireEnvironmentValue(
        'INITIAL_MASTER_NAME'
      );

    const masterEmail =
      normalizeEmail(
        requireEnvironmentValue(
          'INITIAL_MASTER_EMAIL'
        )
      );

    const masterPassword =
      requireEnvironmentValue(
        'INITIAL_MASTER_PASSWORD'
      );

    await connectDatabase({
      uri: environment.mongodbUri,
      serverSelectionTimeoutMs:
        environment
          .mongodbServerSelectionTimeoutMs,
      maxPoolSize:
        environment.mongodbMaxPoolSize,
      minPoolSize:
        environment.mongodbMinPoolSize,
    });

    const masterUser =
      await seedMasterUser({
        organisationId,
        masterName,
        masterEmail,
        masterPassword,
      });

    await seedPermissionRules({
      organisationId,
      masterUserId:
        masterUser.userId,
    });

    console.log(
      'Initial backend data seeded successfully.'
    );
  } catch (error) {
    console.error(
      `Initial data seed failed: ${error.message}`
    );

    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  runSeed();
}

module.exports = {
  DEFAULT_PERMISSION_RULES,
  PRIMARY_MASTER_DESIGNATION_REASON,
  assertPrimaryMasterCandidate,
  seedMasterUser,
  seedPermissionRules,
  runSeed,
};
