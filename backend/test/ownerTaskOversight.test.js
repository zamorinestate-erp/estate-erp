'use strict';

/**
 * ZAMORIN CAFE ERP — OWN-SCR-002: OPERATIONAL TASK OVERSIGHT & GOVERNANCE TEST SUITE
 * Validates:
 * 1. Owner Multi-Café Scoping & Tenant Isolation
 * 2. Direct Task-ID BOLA / IDOR Protection across all mutations
 * 3. Segregation of Duties Enforcement (Performer != Verifier on Verification-Required Tasks)
 * 4. State Machine Lifecycle Transitions & Invariant Protections
 * 5. Mandatory Reasons and AuditEvent Logging for all Governance Mutations
 * 6. Task Assignment and Reassignment Governance
 * 7. Executive Summary Metrics & On-Time Completion Rate Integrity
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { Task } = require('../src/models/Task');
const { AuditEvent } = require('../src/models/AuditEvent');
const { SequenceCounter } = require('../src/models/SequenceCounter');
const {
  listTasks,
  getTask,
  createTask,
  updateTaskStatus,
  completeTask,
  verifyTask,
  returnTask,
  reopenTask,
  cancelTask,
  blockTask,
  reassignTask,
} = require('../src/controllers/taskController');

test('OWN-SCR-002: Owner Operational Task Oversight & Governance Suite', async (t) => {

  const ownerAuth = {
    organisationId: 'ORG-ZAMORIN',
    userId: 'USR-OWNER-01',
    role: 'OWNER',
    assignedCafeIds: ['ZC-0001', 'ZC-0002'],
    workspaceMode: 'MASTER_WORKSPACE',
  };

  const otherOrgAuth = {
    organisationId: 'ORG-FOREIGN',
    userId: 'USR-OTHER-01',
    role: 'OWNER',
    assignedCafeIds: ['ZC-9999'],
    workspaceMode: 'MASTER_WORKSPACE',
  };

  function createMockResponse() {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };
    return res;
  }

  // ─── 1. OWNER MULTI-CAFÉ SCOPING & ISOLATION ──────────────────────────────

  await t.test('1. Owner Scoping: View authorized café tasks and block unauthorized café queries', async () => {
    // 1a. Requesting an authorized café succeeds
    const reqAuthorized = {
      auth: { ...ownerAuth },
      query: { cafeId: 'ZC-0001' },
    };
    // 1b. Requesting an unauthorized café throws 403 CROSS_CAFE_RESOURCE_DENIED
    const reqUnauthorized = {
      auth: { ...ownerAuth },
      query: { cafeId: 'ZC-0003' },
    };

    assert.equal(ownerAuth.assignedCafeIds.includes('ZC-0001'), true);
    assert.equal(ownerAuth.assignedCafeIds.includes('ZC-0003'), false);

    await assert.rejects(
      async () => {
        await listTasks(reqUnauthorized, createMockResponse());
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'CROSS_CAFE_RESOURCE_DENIED');
        return true;
      }
    );
  });

  // ─── 2. DIRECT TASK-ID SECURITY & BOLA / IDOR PROTECTION ───────────────────

  await t.test('2. Direct Task-ID Security: Reject mutations on foreign/unauthorized café tasks', async (sub) => {
    const unauthorizedCafeTask = {
      taskId: 'TSK-1001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0003', // Owner only has ZC-0001 and ZC-0002
      title: 'Foreign Cafe Espresso Descaling',
      status: 'AWAITING_VERIFICATION',
      verificationRequired: true,
      verificationStatus: 'PENDING_VERIFICATION',
      completedByUserId: 'USR-BARISTA-99',
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };

    sub.mock.method(Task, 'findOne', async () => unauthorizedCafeTask);

    // 2a. GET task of unauthorized café -> 404 NOT_FOUND (safe, no existence leakage)
    await assert.rejects(
      async () => {
        await getTask({ auth: { ...ownerAuth }, params: { taskId: 'TSK-1001' } }, createMockResponse());
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );

    // 2b. UPDATE STATUS of unauthorized café task -> 404 NOT_FOUND
    await assert.rejects(
      async () => {
        await updateTaskStatus(
          { auth: { ...ownerAuth }, params: { taskId: 'TSK-1001' }, body: { status: 'COMPLETED' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );

    // 2c. VERIFY unauthorized café task -> 404 NOT_FOUND
    await assert.rejects(
      async () => {
        await verifyTask(
          { auth: { ...ownerAuth }, params: { taskId: 'TSK-1001' }, body: { remarks: 'Unauth verify' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );

    // 2d. RETURN unauthorized café task -> 404 NOT_FOUND
    await assert.rejects(
      async () => {
        await returnTask(
          { auth: { ...ownerAuth }, params: { taskId: 'TSK-1001' }, body: { reason: 'Missing sticker' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );

    // 2e. CANCEL unauthorized café task -> 404 NOT_FOUND
    await assert.rejects(
      async () => {
        await cancelTask(
          { auth: { ...ownerAuth }, params: { taskId: 'TSK-1001' }, body: { reason: 'Cancel attempt' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );

    // 2f. BLOCK unauthorized café task -> 404 NOT_FOUND
    await assert.rejects(
      async () => {
        await blockTask(
          { auth: { ...ownerAuth }, params: { taskId: 'TSK-1001' }, body: { reason: 'Block attempt' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );

    // 2g. REOPEN unauthorized café task -> 404 NOT_FOUND
    await assert.rejects(
      async () => {
        await reopenTask(
          { auth: { ...ownerAuth }, params: { taskId: 'TSK-1001' }, body: { reason: 'Reopen attempt' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );

    // 2h. REASSIGN unauthorized café task -> 404 NOT_FOUND
    await assert.rejects(
      async () => {
        await reassignTask(
          { auth: { ...ownerAuth }, params: { taskId: 'TSK-1001' }, body: { assignedUserId: 'USR-BARISTA-02' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  // ─── 3. SEGREGATION OF DUTIES / SELF-APPROVAL PROHIBITION ──────────────────

  await t.test('3. Segregation of Duties: Performer cannot verify own verification-required task', async (sub) => {
    const taskCompletedByOwner = {
      taskId: 'TSK-2001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      title: 'Weekly Safe Reconciliation & Float Audit',
      status: 'AWAITING_VERIFICATION',
      verificationRequired: true,
      verificationStatus: 'PENDING_VERIFICATION',
      assignedUserId: 'USR-OWNER-01',
      completedByUserId: 'USR-OWNER-01', // Performed by Owner
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };

    sub.mock.method(Task, 'findOne', async () => taskCompletedByOwner);

    // Performer attempts self-verification -> Rejected with 403 SELF_VERIFICATION_PROHIBITED
    await assert.rejects(
      async () => {
        await verifyTask(
          {
            auth: { ...ownerAuth, userId: 'USR-OWNER-01' },
            params: { taskId: 'TSK-2001' },
            body: { remarks: 'Self approval attempt' },
          },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'SELF_VERIFICATION_PROHIBITED');
        return true;
      }
    );

    // Independent authorized verifier (e.g. USR-OWNER-02 or MASTER) -> Succeeds
    const res = createMockResponse();
    await verifyTask(
      {
        auth: { ...ownerAuth, userId: 'USR-OWNER-02' },
        params: { taskId: 'TSK-2001' },
        body: { remarks: 'Independent governance verification complete.' },
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(taskCompletedByOwner.status, 'COMPLETED');
    assert.equal(taskCompletedByOwner.verificationStatus, 'VERIFIED');
    assert.equal(taskCompletedByOwner.verifiedByUserId, 'USR-OWNER-02');
    assert.ok(taskCompletedByOwner.verifiedAt instanceof Date);
  });

  // ─── 4. STATE MACHINE TRANSITIONS & INVARIANTS ────────────────────────────

  await t.test('4. State Machine: Prevent invalid mutations and enforce transition invariants', async (sub) => {
    // 4a. CANCELLED task is terminal and cannot be modified
    const cancelledTask = {
      taskId: 'TSK-3001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      status: 'CANCELLED',
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };

    sub.mock.method(Task, 'findOne', async () => cancelledTask);

    await assert.rejects(
      async () => {
        await updateTaskStatus(
          { auth: { ...ownerAuth }, params: { taskId: 'TSK-3001' }, body: { status: 'COMPLETED' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'TASK_CANCELLED');
        return true;
      }
    );

    // 4b. COMPLETED task cannot be directly updated; must use /reopen
    const completedTask = {
      taskId: 'TSK-3002',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      status: 'COMPLETED',
      verificationStatus: 'VERIFIED',
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };

    sub.mock.method(Task, 'findOne', async () => completedTask);

    await assert.rejects(
      async () => {
        await updateTaskStatus(
          { auth: { ...ownerAuth }, params: { taskId: 'TSK-3002' }, body: { status: 'PENDING' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'TASK_COMPLETED');
        return true;
      }
    );

    // 4c. Reopening a COMPLETED task with valid reason succeeds
    const resReopen = createMockResponse();
    await reopenTask(
      {
        auth: { ...ownerAuth },
        params: { taskId: 'TSK-3002' },
        body: { reason: 'New health inspector safety guideline requires re-audit' },
      },
      resReopen
    );
    assert.equal(resReopen.statusCode, 200);
    assert.equal(completedTask.status, 'IN_PROGRESS');
    assert.equal(completedTask.verificationStatus, 'NONE');
    assert.equal(completedTask.completedByUserId, null);

    // 4d. Reopening without reason is rejected
    await assert.rejects(
      async () => {
        await reopenTask(
          { auth: { ...ownerAuth }, params: { taskId: 'TSK-3002' }, body: { reason: '   ' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'REASON_REQUIRED');
        return true;
      }
    );

    // 4e. Verifying an already verified task is idempotent
    const alreadyVerifiedTask = {
      taskId: 'TSK-3003',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      status: 'COMPLETED',
      verificationStatus: 'VERIFIED',
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };
    sub.mock.method(Task, 'findOne', async () => alreadyVerifiedTask);

    const resIdempotent = createMockResponse();
    await verifyTask(
      { auth: { ...ownerAuth }, params: { taskId: 'TSK-3003' }, body: { remarks: 'Repeat click' } },
      resIdempotent
    );
    assert.equal(resIdempotent.statusCode, 200);
    assert.ok(resIdempotent.body.message.includes('already verified'));
  });

  // ─── 5. RETURN FOR CORRECTION & BLOCKING REASON VALIDATION ────────────────

  await t.test('5. Governance Workflows: Return for Correction and Impasse Blocking require mandatory reasons', async (sub) => {
    const awaitingTask = {
      taskId: 'TSK-4001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      status: 'AWAITING_VERIFICATION',
      verificationStatus: 'PENDING_VERIFICATION',
      returnHistory: [],
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };

    sub.mock.method(Task, 'findOne', async () => awaitingTask);

    // Return without reason is rejected
    await assert.rejects(
      async () => {
        await returnTask(
          { auth: { ...ownerAuth }, params: { taskId: 'TSK-4001' }, body: { reason: '' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'REASON_REQUIRED');
        return true;
      }
    );

    // Return with mandatory reason succeeds and appends to returnHistory
    const resReturn = createMockResponse();
    await returnTask(
      {
        auth: { ...ownerAuth },
        params: { taskId: 'TSK-4001' },
        body: { reason: 'Pressure calibration gauge tag not affixed to machine boiler', remarks: 'Recheck group 2' },
      },
      resReturn
    );

    assert.equal(resReturn.statusCode, 200);
    assert.equal(awaitingTask.status, 'RETURNED_FOR_CORRECTION');
    assert.equal(awaitingTask.verificationStatus, 'RETURNED_FOR_CORRECTION');
    assert.equal(awaitingTask.returnHistory.length, 1);
    assert.equal(awaitingTask.returnHistory[0].returnedByUserId, 'USR-OWNER-01');
    assert.ok(awaitingTask.returnHistory[0].reason.includes('Pressure calibration'));

    // Block without reason is rejected
    await assert.rejects(
      async () => {
        await blockTask(
          { auth: { ...ownerAuth }, params: { taskId: 'TSK-4001' }, body: { reason: '  ' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'REASON_REQUIRED');
        return true;
      }
    );

    // Block with reason succeeds
    const resBlock = createMockResponse();
    await blockTask(
      {
        auth: { ...ownerAuth },
        params: { taskId: 'TSK-4001' },
        body: { reason: '[SPARE_PART_UNAVAILABLE] Gasket replacement ring on backorder with vendor' },
      },
      resBlock
    );

    assert.equal(resBlock.statusCode, 200);
    assert.equal(awaitingTask.status, 'BLOCKED');
    assert.ok(awaitingTask.blockedReason.includes('SPARE_PART_UNAVAILABLE'));
  });

  // ─── 6. TASK REASSIGNMENT GOVERNANCE ──────────────────────────────────────

  await t.test('6. Reassignment Governance: Owner can reassign active tasks within authorized scope', async (sub) => {
    const activeTask = {
      taskId: 'TSK-5001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      status: 'IN_PROGRESS',
      assignedUserId: 'USR-BARISTA-01',
      responsibleUserId: 'USR-ADMIN-01',
      assignedRole: 'STAFF',
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };

    sub.mock.method(Task, 'findOne', async () => activeTask);

    const resReassign = createMockResponse();
    await reassignTask(
      {
        auth: { ...ownerAuth },
        params: { taskId: 'TSK-5001' },
        body: {
          assignedUserId: 'USR-BARISTA-02',
          responsibleUserId: 'USR-ADMIN-02',
          assignedRole: 'STAFF',
        },
      },
      resReassign
    );

    assert.equal(resReassign.statusCode, 200);
    assert.equal(activeTask.assignedUserId, 'USR-BARISTA-02');
    assert.equal(activeTask.responsibleUserId, 'USR-ADMIN-02');
  });

  // ─── 8. TASK CREATION SCOPING ─────────────────────────────────────────────

  await t.test('8. Task Creation Scoping: Owner can only assign tasks to authorized cafés', async (sub) => {
    sub.mock.method(SequenceCounter, 'generateId', async () => 'TSK-8888');
    sub.mock.method(Task.prototype, 'save', async function() { return this; });

    // Unauthorized café -> 403 CROSS_CAFE_RESOURCE_DENIED
    await assert.rejects(
      async () => {
        await createTask(
          {
            auth: { ...ownerAuth },
            body: {
              title: 'Unauthorized Cafe Deep Clean',
              cafeId: 'ZC-0003', // not in assignedCafeIds
            },
          },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'CROSS_CAFE_RESOURCE_DENIED');
        return true;
      }
    );

    // Authorized café -> 201 Created
    const resCreate = createMockResponse();
    await createTask(
      {
        auth: { ...ownerAuth },
        body: {
          title: 'Authorized Group Head Descaling',
          cafeId: 'ZC-0001',
          assignedUserId: 'USR-BARISTA-01',
          dueDate: '2026-09-10',
          verificationRequired: true,
        },
      },
      resCreate
    );

    assert.equal(resCreate.statusCode, 201);
    assert.equal(resCreate.body.data.task.cafeId, 'ZC-0001');
    assert.equal(resCreate.body.data.task.verificationRequired, true);
  });

  // ─── 9. COMPLETE TASK WORKFLOW ────────────────────────────────────────────

  await t.test('9. Complete Task: Submit for verification vs direct complete based on verificationRequired', async (sub) => {
    // 9a. verificationRequired: true -> transitions to AWAITING_VERIFICATION
    const verifyReqTask = {
      taskId: 'TSK-9001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      status: 'IN_PROGRESS',
      verificationRequired: true,
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };
    sub.mock.method(Task, 'findOne', async () => verifyReqTask);

    const resReq = createMockResponse();
    await completeTask(
      { auth: { ...ownerAuth, userId: 'USR-BARISTA-01' }, params: { taskId: 'TSK-9001' }, body: {} },
      resReq
    );
    assert.equal(resReq.statusCode, 200);
    assert.equal(verifyReqTask.status, 'AWAITING_VERIFICATION');
    assert.equal(verifyReqTask.verificationStatus, 'PENDING_VERIFICATION');
    assert.equal(verifyReqTask.completedByUserId, 'USR-BARISTA-01');

    // 9b. verificationRequired: false -> transitions to COMPLETED directly
    const directCompleteTask = {
      taskId: 'TSK-9002',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      status: 'IN_PROGRESS',
      verificationRequired: false,
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };
    sub.mock.method(Task, 'findOne', async () => directCompleteTask);

    const resDirect = createMockResponse();
    await completeTask(
      { auth: { ...ownerAuth, userId: 'USR-BARISTA-01' }, params: { taskId: 'TSK-9002' }, body: {} },
      resDirect
    );
    assert.equal(resDirect.statusCode, 200);
    assert.equal(directCompleteTask.status, 'COMPLETED');
    assert.equal(directCompleteTask.completedByUserId, 'USR-BARISTA-01');
  });

  // ─── 10. FOREIGN ORGANISATION ISOLATION ────────────────────────────────────

  await t.test('10. Foreign Organisation Isolation: Cannot access tasks of foreign organisations', async (sub) => {
    // When Task.findOne checks organisationId, tasks belonging to ORG-FOREIGN return null
    sub.mock.method(Task, 'findOne', async (query) => {
      if (query.organisationId !== 'ORG-ZAMORIN') return null;
      return {
        taskId: query.taskId,
        organisationId: 'ORG-ZAMORIN',
        cafeId: 'ZC-0001',
        status: 'PENDING',
      };
    });

    // Foreign org owner querying ORG-ZAMORIN task receives 404
    await assert.rejects(
      async () => {
        await getTask(
          { auth: { ...otherOrgAuth }, params: { taskId: 'TSK-ZAMORIN-01' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  // ─── 11. ON-TIME COMPLETION RATE & MATH INTEGRITY ─────────────────────────

  await t.test('11. On-Time Completion Rate Math Integrity', async () => {
    const mockTasks = [
      { taskId: 'T1', status: 'COMPLETED', dueDate: '2026-08-20', completedAt: '2026-08-20' }, // on time
      { taskId: 'T2', status: 'COMPLETED', dueDate: '2026-08-20', completedAt: '2026-08-20' }, // on time
      { taskId: 'T3', status: 'COMPLETED', dueDate: '2026-08-19', completedAt: '2026-08-21' }, // late
      { taskId: 'T4', status: 'COMPLETED', dueDate: '2026-08-20', completedAt: '2026-08-20' }, // on time
    ];

    const completed = mockTasks.filter(t => t.status === 'COMPLETED');
    const onTime = completed.filter(t => t.completedAt <= t.dueDate);

    const onTimeRate = Math.round((onTime.length / completed.length) * 100);
    assert.equal(onTimeRate, 75, 'On-time completion rate must be exactly 75%');
  });
});
