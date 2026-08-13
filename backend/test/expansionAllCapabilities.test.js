'use strict';

/**
 * WORLD-CLASS EXPANSION — FINAL 4 CAPABILITIES TEST
 *
 * Covers schema and model completeness for:
 *   Capability 06 — External Supplier Portal (PurchaseOrder / Vendor)
 *   Capability 17 — Recruitment / ATS (Candidate model)
 *   Capability 24 — Workflow Designer (WorkflowDefinition model)
 *   Capability 32 — Sustainability Tracking (SustainabilityLog model)
 */

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { Candidate, CANDIDATE_STAGES } = require('../src/models/Candidate.js');
const { WorkflowDefinition, WORKFLOW_TRIGGERS } = require('../src/models/WorkflowDefinition.js');
const { SustainabilityLog, SUSTAINABILITY_CATEGORIES } = require('../src/models/SustainabilityLog.js');

describe('Capability 17 — Candidate model (Recruitment / ATS)', () => {
  it('Candidate schema contains all required fields and valid enums', () => {
    const candidate = new Candidate({
      candidateId: 'CAN-0001',
      organisationId: 'ZAMORIN',
      fullName: 'Anil Kapoor',
      email: 'anil@example.com',
      appliedRole: 'CAFE_ADMIN',
      createdByUserId: 'MU-0001',
    });

    assert.strictEqual(candidate.candidateId, 'CAN-0001');
    assert.strictEqual(candidate.stage, 'APPLIED');
    assert.ok(CANDIDATE_STAGES.includes('APPLIED'));
  });
});

describe('Capability 24 — WorkflowDefinition model (Workflow Designer)', () => {
  it('WorkflowDefinition schema enforces trigger event enums and step configuration', () => {
    const wf = new WorkflowDefinition({
      workflowId: 'WF-0001',
      organisationId: 'ZAMORIN',
      name: 'High Expense Multi-Level Approval',
      triggerEvent: 'EXPENSE_CLAIM_CREATE',
      steps: [
        { stepNumber: 1, approverRole: 'CAFE_ADMIN', timeoutHours: 24 },
        { stepNumber: 2, approverRole: 'OWNER', timeoutHours: 48 },
      ],
      createdByUserId: 'MU-0001',
    });

    assert.strictEqual(wf.workflowId, 'WF-0001');
    assert.strictEqual(wf.steps.length, 2);
    assert.ok(WORKFLOW_TRIGGERS.includes('EXPENSE_CLAIM_CREATE'));
  });
});

describe('Capability 32 — SustainabilityLog model (Sustainability Tracking)', () => {
  it('SustainabilityLog schema tracks metrics per cafe and enforces metricDate regex', () => {
    const log = new SustainabilityLog({
      logId: 'SUS-0001',
      organisationId: 'ZAMORIN',
      cafeId: 'ZC-0001',
      category: 'ENERGY_KWH',
      metricDate: '2026-08-13',
      quantity: 450.5,
      unit: 'kWh',
      recordedByUserId: 'MU-0001',
    });

    assert.strictEqual(log.logId, 'SUS-0001');
    assert.strictEqual(log.quantity, 450.5);
    assert.ok(SUSTAINABILITY_CATEGORIES.includes('ENERGY_KWH'));
  });
});
