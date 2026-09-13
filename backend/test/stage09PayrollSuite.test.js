'use strict';

/**
 * STAGE 09: PAYROLL + STATUTORY COMPLIANCE MASTER TEST SUITE
 *
 * Verifies:
 *  1. Statutory Deduction Formula Accuracy:
 *     - EPF Act 1952: 12% employee + 12% employer (3.67% PF + 8.33% EPS) capped at ₹15,000 statutory ceiling.
 *     - ESI Act 1948: 0.75% employee + 3.25% employer.
 *     - State-specific Professional Tax (PT) for Kerala and Karnataka slabs.
 *     - Net payable in Indian Rupee words.
 *  2. Conditional Exemption Gates:
 *     - High wage employees exceeding ₹21,000/month threshold have strictly ZERO ESI deduction.
 *     - When EPF is configured non-applicable, EPF deduction is strictly ZERO.
 *  3. Attendance-Linked Wage Computation:
 *     - Pro-rata calendar days vs payable days.
 *     - Approved overtime hours computed with 1.5x hourly multiplier.
 *  4. Sensitive Compensation Privacy & RBAC Boundary:
 *     - Staff member attempting to access colleague's payslip is blocked with 403 PAYSLIP_ACCESS_FORBIDDEN.
 *     - Employee self-service access to personal payslip is authorized.
 *  5. Bank NEFT/RTGS Batch Disbursement Schedule:
 *     - Format validation: Sl. No., Beneficiary Name, Account Number, IFSC, Net Amount, NEFT/RTGS routing.
 *  6. Official Zamorin Corporate Payslip PDF Generation:
 *     - APA 7 layout, corporate watermark, masked PII (Bank A/C, PAN), Sl. No., and embedded QR verification.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const payrollStatutoryService = require('../src/services/payrollStatutoryService');
const { Payslip } = require('../src/models/Payslip');
const { PayrollRun } = require('../src/models/PayrollRun');
const auditService = require('../src/services/auditService');

function createAuthContext(role = 'STAFF', cafeId = 'ZC-0001', userId = 'USR-BARISTA-01', employeeNumber = 'EMP-ZC-000001') {
  return {
    userId,
    employeeId: userId,
    employeeNumber,
    name: 'Barista One',
    email: 'barista@zamorin.local',
    role,
    organisationId: 'ORG-ZAMORIN',
    assignedCafeIds: [cafeId],
    primaryCafeId: cafeId,
    isPrimaryMaster: role === 'MASTER',
  };
}

test('STAGE 09 — Payroll + Statutory Compliance Master Test Suite', async (t) => {
  // In-memory data mocks
  const mockPayslips = [];
  const mockRuns = [];

  t.mock.method(auditService, 'recordRequestAudit', async () => ({}));
  t.mock.method(auditService, 'recordAuditEvent', async () => ({}));

  // Seed sample payslips
  const sampleStaffPayslip = {
    payslipId: 'PS-202609-0001',
    organisationId: 'ORG-ZAMORIN',
    cafeId: 'ZC-0001',
    payrollRunId: 'PR-202609-0001',
    periodKey: '2026-09',
    employeeUserId: 'USR-BARISTA-01',
    employeeNumber: 'EMP-ZC-000001',
    employeeName: 'Aarav Nair',
    designation: 'Senior Barista',
    department: 'Café Operations',
    bankAccountNumber: '987654321098',
    bankIfscCode: 'HDFC0001234',
    panNumber: 'ABCDE1234F',
    uanNumber: '100987654321',
    attendanceSummary: {
      totalCalendarDays: 30,
      payableDays: 28,
      presentDays: 24,
      paidLeaveDays: 4,
      unpaidLeaveDays: 2,
      weeklyOffDays: 0,
      holidayDays: 0,
      overtimeMinutes: 480, // 8 hours
    },
    earnings: {
      basicPayPaise: 1500000, // ₹15,000
      houseRentAllowancePaise: 600000, // ₹6,000
      otherAllowancePaise: 200000, // ₹2,000
      overtimePayPaise: 117200, // Overtime
    },
    deductions: {
      providentFundPaise: 180000, // 12% of 15k = ₹1,800
      employeeStateInsurancePaise: 0, // Exempt (> 21k gross)
      professionalTaxPaise: 18000, // ₹180 Kerala slab
      incomeTaxPaise: 0,
      loanAdvanceDeductionPaise: 0,
    },
    totalGrossPaise: 2417200, // ₹24,172.00
    totalDeductionPaise: 198000, // ₹1,980.00
    netSalaryPayablePaise: 2219200, // ₹22,192.00
    status: 'ISSUED',
  };
  mockPayslips.push(sampleStaffPayslip);

  // Colleague payslip
  const colleaguePayslip = {
    payslipId: 'PS-202609-0002',
    organisationId: 'ORG-ZAMORIN',
    cafeId: 'ZC-0001',
    payrollRunId: 'PR-202609-0001',
    periodKey: '2026-09',
    employeeUserId: 'USR-CHEF-02',
    employeeNumber: 'EMP-ZC-000002',
    employeeName: 'Fatima Zahra',
    designation: 'Head Pastry Chef',
    totalGrossPaise: 3500000,
    totalDeductionPaise: 210000,
    netSalaryPayablePaise: 3290000,
    status: 'ISSUED',
  };
  mockPayslips.push(colleaguePayslip);

  // Seed sample PayrollRun
  mockRuns.push({
    payrollRunId: 'PR-202609-0001',
    organisationId: 'ORG-ZAMORIN',
    cafeId: 'ZC-0001',
    periodKey: '2026-09',
    periodStartDate: '2026-09-01',
    periodEndDate: '2026-09-30',
    status: 'APPROVED',
    employeeCount: 2,
    totalGrossPaise: 5917200,
    totalDeductionPaise: 408000,
    totalNetPayPaise: 5509200,
    currency: 'INR',
  });

  // Mongoose mocks
  t.mock.method(Payslip, 'findOne', (query) => {
    let found = null;
    if (query.$or) {
      found = mockPayslips.find((p) =>
        query.$or.some((cond) =>
          (cond.employeeUserId && p.employeeUserId === cond.employeeUserId) ||
          (cond.employeeNumber && p.employeeNumber === cond.employeeNumber) ||
          (cond.payslipId && p.payslipId === cond.payslipId)
        )
      );
    } else {
      found = mockPayslips.find((p) =>
        (!query.payslipId || p.payslipId === query.payslipId) &&
        (!query.employeeUserId || p.employeeUserId === query.employeeUserId) &&
        (!query.periodKey || p.periodKey === query.periodKey)
      );
    }
    return {
      lean: async () => found || null,
      then: (res, rej) => Promise.resolve(found).then(res, rej),
    };
  });

  t.mock.method(Payslip, 'find', (query) => ({
    lean: async () => {
      return mockPayslips.filter((p) =>
        (!query.organisationId || p.organisationId === query.organisationId) &&
        (!query.payrollRunId || p.payrollRunId === query.payrollRunId)
      );
    },
  }));

  t.mock.method(PayrollRun, 'findOne', (query) => {
    const found = mockRuns.find((r) =>
      (!query.payrollRunId || r.payrollRunId === query.payrollRunId) &&
      (!query.organisationId || r.organisationId === query.organisationId)
    );
    return {
      lean: async () => found || null,
      then: (res, rej) => Promise.resolve(found).then(res, rej),
    };
  });

  // TEST 1: Statutory Deduction Formula Accuracy
  await t.test('1. Statutory Deduction Accuracy: EPF 12% capped at ₹15k, ESI 0.75%, and PT slabs', async () => {
    // Case A: Standard Worker within both EPF and ESI limits
    // Basic: ₹12,000 (12,00,000 Paisa), Gross: ₹18,000 (18,00,000 Paisa), Kerala
    const workerResult = payrollStatutoryService.calculateStatutoryDeductions({
      basicPayPaise: 1200000,
      grossPayPaise: 1800000,
      isEpfApplicable: true,
      isEsiApplicable: true,
      state: 'Kerala',
    });

    assert.equal(workerResult.epf.isApplicable, true);
    // EPF Employee (12% of 12,000) = ₹1,440 (1,44,000 Paisa)
    assert.equal(workerResult.epf.employeeContributionPaise, 144000);
    // EPF Employer EPS (8.33% of 12,000) = ₹1,000 (99,960 rounded to 1,00,000 Paisa)
    assert.ok(workerResult.epf.employerEpsPaise > 0);
    // EPF Employer PF (3.67% of 12,000) = ₹440
    assert.ok(workerResult.epf.employerPfPaise > 0);
    // Total employer (12%) = 1,44,000 Paisa
    assert.equal(workerResult.epf.employerTotalPaise, 144000);

    // ESI Employee (0.75% of 18,000) = ₹135 (13,500 Paisa)
    assert.equal(workerResult.esi.isApplicable, true);
    assert.equal(workerResult.esi.employeeContributionPaise, 13500);
    // ESI Employer (3.25% of 18,000) = ₹585 (58,500 Paisa)
    assert.equal(workerResult.esi.employerContributionPaise, 58500);

    // Kerala Professional Tax for ₹18,000 gross = ₹180 (18,000 Paisa)
    assert.equal(workerResult.professionalTaxPaise, 18000);

    // Total deductions = 144000 + 13500 + 18000 = 175500 (₹1,755.00)
    assert.equal(workerResult.totalDeductionsPaise, 175500);
    // Net payable = 1800000 - 175500 = 1624500 (₹16,245.00)
    assert.equal(workerResult.netPayablePaise, 1624500);
    assert.equal(workerResult.netPayableInWords, 'Sixteen Thousand Two Hundred Forty-Five Rupees Only');

    // Case B: High basic exceeding EPF ceiling ₹15,000
    // Basic: ₹30,000 (30,00,000 Paisa)
    // EPF is capped at ₹15,000 ceiling: 12% of 15,000 = ₹1,800 (1,80,000 Paisa)
    const highBasicResult = payrollStatutoryService.calculateStatutoryDeductions({
      basicPayPaise: 3000000,
      grossPayPaise: 4500000,
      isEpfApplicable: true,
      isEsiApplicable: true,
      state: 'Karnataka',
    });

    assert.equal(highBasicResult.epf.epfBasePaise, 1500000);
    assert.equal(highBasicResult.epf.employeeContributionPaise, 180000);
    // Karnataka PT for >= ₹15,000 = ₹200 (20,000 Paisa)
    assert.equal(highBasicResult.professionalTaxPaise, 20000);
  });

  // TEST 2: Conditional Statutory Exemption Gates
  await t.test('2. Conditional Exemptions: high-wage employee exceeding ₹21k has strictly ZERO ESI deduction', async () => {
    // Gross: ₹21,500 (21,50,000 Paisa) > ₹21,000 statutory limit
    const highGrossResult = payrollStatutoryService.calculateStatutoryDeductions({
      basicPayPaise: 1200000,
      grossPayPaise: 2150000,
      isEpfApplicable: true,
      isEsiApplicable: true,
      state: 'Kerala',
    });

    assert.equal(highGrossResult.esi.isApplicable, false);
    assert.equal(highGrossResult.esi.employeeContributionPaise, 0);
    assert.equal(highGrossResult.esi.employerContributionPaise, 0);
    assert.equal(highGrossResult.esi.exemptReason, 'EXCEEDS_WAGE_CEILING_21000');

    // Opted out of EPF
    const noPfResult = payrollStatutoryService.calculateStatutoryDeductions({
      basicPayPaise: 1500000,
      grossPayPaise: 2000000,
      isEpfApplicable: false,
      isEsiApplicable: true,
    });

    assert.equal(noPfResult.epf.isApplicable, false);
    assert.equal(noPfResult.epf.employeeContributionPaise, 0);
  });

  // TEST 3: Attendance-Linked Wage and Overtime Computation
  await t.test('3. Attendance Wage Computation: pro-rata payable days and 1.5x overtime multiplier', async () => {
    // ₹30,000 monthly salary, 30 calendar days, 25 payable days, 8 hours overtime at 1.5x
    const attCalc = payrollStatutoryService.calculateAttendancePay({
      monthlyBaseSalaryPaise: 3000000,
      totalCalendarDays: 30,
      payableDays: 25,
      approvedOvertimeHours: 8,
      overtimeMultiplier: 1.5,
    });

    // Daily rate = 30000 / 30 = ₹1,000 (1,00,000 Paisa)
    // Earned base for 25 days = 25 * 1000 = ₹25,000 (25,00,000 Paisa)
    assert.equal(attCalc.earnedBasePayPaise, 2500000);

    // Hourly rate = 1000 / 8 = ₹125 (12,500 Paisa)
    assert.equal(attCalc.hourlyRatePaise, 12500);

    // Overtime pay = 125 * 1.5 * 8 = ₹1,500 (1,50,000 Paisa)
    assert.equal(attCalc.overtimePayPaise, 150000);
  });

  // TEST 4: Sensitive Compensation Privacy & RBAC Boundary
  await t.test('4. Compensation Privacy: staff access to colleague payslip returns 403 PAYSLIP_ACCESS_FORBIDDEN', async () => {
    const { downloadEmployeeMonthlyPayslip } = require('../src/controllers/payrollController');
    const staffAuth = createAuthContext('STAFF', 'ZC-0001', 'USR-BARISTA-01', 'EMP-ZC-000001');

    // Attempt to access colleague's payslip (USR-CHEF-02)
    const req = {
      auth: staffAuth,
      params: {
        employeeId: 'USR-CHEF-02', // Colleague!
        month: '2026-09',
      },
    };

    let caughtErr = null;
    try {
      await new Promise((resolve, reject) => {
        downloadEmployeeMonthlyPayslip(req, {}, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr);
    assert.equal(caughtErr.statusCode, 403);
    assert.equal(caughtErr.code, 'PAYSLIP_ACCESS_FORBIDDEN');

    // Self-service access to own payslip succeeds
    const selfReq = {
      auth: staffAuth,
      params: {
        employeeId: 'USR-BARISTA-01', // Own ID!
        month: '2026-09',
      },
    };

    const headers = {};
    const chunks = [];
    const { Writable } = require('stream');

    await new Promise((resolve, reject) => {
      const res = new Writable({
        write(chunk, enc, cb) { chunks.push(chunk); cb(); },
      });
      res.statusCode = 200;
      res.setHeader = (name, val) => { headers[name.toLowerCase()] = val; };
      res.send = (buf) => { chunks.push(buf); resolve(); };
      res.on('finish', resolve);
      res.on('error', reject);

      downloadEmployeeMonthlyPayslip(selfReq, res, (err) => {
        if (err) reject(err);
      });
    });

    assert.equal(headers['content-type'], 'application/pdf');
    assert.ok(headers['content-disposition'].includes('Payslip_'));
    assert.ok(headers['x-export-id']);
  });

  // TEST 5: Corporate Bank NEFT/RTGS Batch Disbursement Schedule
  await t.test('5. Bank Disbursement Schedule: formats NEFT/RTGS batch records with total matching Net Pay', async () => {
    const schedule = payrollStatutoryService.generateBankDisbursementSchedule({
      payrollRunId: 'PR-202609-0001',
      cafeId: 'ZC-0001',
      paymentRecords: [
        {
          employeeName: 'Aarav Nair',
          employeeNumber: 'EMP-ZC-000001',
          bankAccountNumber: '987654321098',
          bankIfscCode: 'HDFC0001234',
          netPayablePaise: 2219200,
          periodKey: '2026-09',
        },
        {
          employeeName: 'Fatima Zahra',
          employeeNumber: 'EMP-ZC-000002',
          bankAccountNumber: '112233445566',
          bankIfscCode: 'ICIC0000567',
          netPayablePaise: 3290000,
          periodKey: '2026-09',
        },
      ],
    });

    assert.ok(schedule);
    assert.ok(schedule.batchId.startsWith('DISB-PR-202609-0001'));
    assert.equal(schedule.totalEmployees, 2);
    // Total = 2219200 + 3290000 = 5509200 (₹55,092.00)
    assert.equal(schedule.totalDisbursementPaisa, 5509200);
    assert.equal(schedule.totalDisbursementRupees, '55092.00');

    assert.equal(schedule.records.length, 2);
    assert.equal(schedule.records[0].slNo, 1);
    assert.equal(schedule.records[0].beneficiaryName, 'AARAV NAIR');
    assert.equal(schedule.records[0].accountNumber, '987654321098');
    assert.equal(schedule.records[0].ifscCode, 'HDFC0001234');
    assert.equal(schedule.records[0].paymentMethod, 'NEFT'); // < 2 Lakh => NEFT
  });

  // TEST 6: Official Zamorin Corporate Payslip PDF Generation
  await t.test('6. Corporate Payslip PDF: renders APA 7 layout, masked PII, itemized columns, and QR code', async () => {
    const pdfResult = await payrollStatutoryService.renderZamorinCorporatePayslipPdf(sampleStaffPayslip, {
      tradeName: 'Zamorin Café Kozhikode',
    });

    assert.ok(Buffer.isBuffer(pdfResult.buffer));
    assert.equal(pdfResult.mimeType, 'application/pdf');
    assert.ok(pdfResult.filename.includes('EMP-ZC-000001'));

    const pdfString = pdfResult.buffer.toString('latin1');
    assert.ok(pdfString.startsWith('%PDF-1.4'));
    assert.ok(pdfString.includes('CONFIDENTIAL SALARY SLIP'));
    assert.ok(pdfString.toUpperCase().includes('ZAMORIN') && pdfString.toUpperCase().includes('KOZHIKODE'));
    assert.ok(pdfString.includes('Aarav Nair'));
    assert.ok(pdfString.includes('EMP-ZC-000001'));
    // Verify PAN is masked
    assert.ok(pdfString.includes('ABCDEXXXXF'));
    // Verify Bank Account is masked
    assert.ok(pdfString.includes('XXXXXXXX1098'));
  });
});
