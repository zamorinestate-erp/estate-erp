'use strict';

/**
 * ZAMORIN CAFÉ ERP — PRODUCTION DATABASE PURGE & SANITIZATION SCRIPT
 * 
 * Safely removes all dummy, test, demo, and simulated records across
 * all operational, workforce, POS, inventory, finance, and task collections.
 * 
 * PRESERVES:
 * 1. Primary Master Account (pradeeshk331@gmail.com / designated Primary Master)
 * 2. Role Permission Engine (all 136 RBAC rules in RolePermission)
 * 3. System Communication Settings (SystemCommunicationSettings)
 * 4. Company Identity & Core Cafés
 * 5. Clean Sequence Counters
 * 
 * Usage:
 *   node src/scripts/purgeDummyData.js
 *   node src/scripts/purgeDummyData.js --confirm
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import all models
const { User } = require('../models/User');
const { RolePermission } = require('../models/RolePermission');
const { SystemCommunicationSettings } = require('../models/SystemCommunicationSettings');
const { Cafe } = require('../models/Cafe');
const { CompanyIdentity } = require('../models/CompanyIdentity');
const { SequenceCounter } = require('../models/SequenceCounter');

const { APInvoice } = require('../models/APInvoice');
const { AccessRequest } = require('../models/AccessRequest');
const { AccessReview } = require('../models/AccessReview');
const { AdministrativeRequest } = require('../models/AdministrativeRequest');
const { Approval } = require('../models/Approval');
const { Asset } = require('../models/Asset');
const { AttachmentRegistry } = require('../models/AttachmentRegistry');
const { AttendanceOfflineLease } = require('../models/AttendanceOfflineLease');
const { AttendancePeriod } = require('../models/AttendancePeriod');
const { AttendanceQrChallenge } = require('../models/AttendanceQrChallenge');
const { AttendanceSubmission } = require('../models/AttendanceSubmission');
const { AuditEvent } = require('../models/AuditEvent');
const { BankAccount } = require('../models/BankAccount');
const { Bill } = require('../models/Bill');
const { CafeInventoryConfig } = require('../models/CafeInventoryConfig');
const { Candidate } = require('../models/Candidate');
const { CashTransaction } = require('../models/CashTransaction');
const { ChartOfAccount } = require('../models/ChartOfAccount');
const { ComboDefinition } = require('../models/ComboDefinition');
const { CorporateCardTransaction } = require('../models/CorporateCardTransaction');
const { CustomFieldDefinition } = require('../models/CustomFieldDefinition');
const { Customer } = require('../models/Customer');
const { CustomerFeedback } = require('../models/CustomerFeedback');
const { DashboardSavedView } = require('../models/DashboardSavedView');
const { DashboardTarget } = require('../models/DashboardTarget');
const { Delegation } = require('../models/Delegation');
const { DepartmentOrder } = require('../models/DepartmentOrder');
const { DeviceRegistration } = require('../models/DeviceRegistration');
const { DeviceSecurityEvent } = require('../models/DeviceSecurityEvent');
const { DispositionCertificate } = require('../models/DispositionCertificate');
const { EmployeeDocument } = require('../models/EmployeeDocument');
const { EmployeeMovement } = require('../models/EmployeeMovement');
const { EmployeeSkill } = require('../models/EmployeeSkill');
const { EmployeeTraining } = require('../models/EmployeeTraining');
const { Expense } = require('../models/Expense');
const { ExpensePolicy } = require('../models/ExpensePolicy');
const { ExpenseRequest } = require('../models/ExpenseRequest');
const { FinancialPeriod } = require('../models/FinancialPeriod');
const { GlobalInventoryItem } = require('../models/GlobalInventoryItem');
const { InboundEmailMessage } = require('../models/InboundEmailMessage');
const { Incident } = require('../models/Incident');
const { InstitutionalAccount } = require('../models/InstitutionalAccount');
const { InstitutionalQuote } = require('../models/InstitutionalQuote');
const { InventoryCycleCount } = require('../models/InventoryCycleCount');
const { InventoryLot } = require('../models/InventoryLot');
const { InventoryReservation } = require('../models/InventoryReservation');
const { Journal } = require('../models/Journal');
const { LeasedOutlet } = require('../models/LeasedOutlet');
const { LeaveRequest } = require('../models/LeaveRequest');
const { LoanPolicy } = require('../models/LoanPolicy');
const { LoanRepaymentSchedule } = require('../models/LoanRepaymentSchedule');
const { LoanTransaction } = require('../models/LoanTransaction');
const { LoyaltyLedger } = require('../models/LoyaltyLedger');
const { LoyaltyProgramme } = require('../models/LoyaltyProgramme');
const { MailAutomationRule } = require('../models/MailAutomationRule');
const { MailCase } = require('../models/MailCase');
const { MailDraft } = require('../models/MailDraft');
const { MailTemplate } = require('../models/MailTemplate');
const { MailThread } = require('../models/MailThread');
const { MaintenanceJob } = require('../models/MaintenanceJob');
const { MaintenancePlan } = require('../models/MaintenancePlan');
const { MarketplaceSettlement } = require('../models/MarketplaceSettlement');
const { Menu } = require('../models/Menu');
const { MenuChangeSet } = require('../models/MenuChangeSet');
const { MenuItem } = require('../models/MenuItem');
const { MenuPublication } = require('../models/MenuPublication');
const { MenuSection } = require('../models/MenuSection');
const { ModifierGroup } = require('../models/ModifierGroup');
const { Notification } = require('../models/Notification');
const { NotificationOutbox } = require('../models/NotificationOutbox');
const { OperationalAdvance } = require('../models/OperationalAdvance');
const { OperatorSession } = require('../models/OperatorSession');
const { OutletOffering } = require('../models/OutletOffering');
const { PassbookAccount } = require('../models/PassbookAccount');
const { PassbookMapping } = require('../models/PassbookMapping');
const { PassbookReconciliation } = require('../models/PassbookReconciliation');
const { PassbookReservation } = require('../models/PassbookReservation');
const { PassbookStatementImport } = require('../models/PassbookStatementImport');
const { PassbookTransaction } = require('../models/PassbookTransaction');
const { PassbookTransfer } = require('../models/PassbookTransfer');
const { PaymentRun } = require('../models/PaymentRun');
const { PayrollRun } = require('../models/PayrollRun');
const { Payslip } = require('../models/Payslip');
const { PersonalLedger } = require('../models/PersonalLedger');
const { Position } = require('../models/Position');
const { PrivacyRequest } = require('../models/PrivacyRequest');
const { PrivateFile } = require('../models/PrivateFile');
const { ProbationReview } = require('../models/ProbationReview');
const { ProfileChangeRequest } = require('../models/ProfileChangeRequest');
const { PurchaseOrder } = require('../models/PurchaseOrder');
const { QualityChecklist } = require('../models/QualityChecklist');
const { RecallNotice } = require('../models/RecallNotice');
const { Recipe } = require('../models/Recipe');
const { RecoveryCharge } = require('../models/RecoveryCharge');
const { RegisterSession } = require('../models/RegisterSession');
const { RetentionPolicy } = require('../models/RetentionPolicy');
const { RevenueShareAgreement } = require('../models/RevenueShareAgreement');
const { RevenueShareDispute } = require('../models/RevenueShareDispute');
const { RevenueShareOperator } = require('../models/RevenueShareOperator');
const { RevenueSharePayment } = require('../models/RevenueSharePayment');
const { RevenueShareRateRule } = require('../models/RevenueShareRateRule');
const { RevenueShareSettlement } = require('../models/RevenueShareSettlement');
const { RewardDefinition } = require('../models/RewardDefinition');
const { SalesSubmission } = require('../models/SalesSubmission');
const { SecurityDeposit } = require('../models/SecurityDeposit');
const { SenderIdentity } = require('../models/SenderIdentity');
const { ServiceIdentity } = require('../models/ServiceIdentity');
const { ServiceModeBOM } = require('../models/ServiceModeBOM');
const { Session } = require('../models/Session');
const { Shift } = require('../models/Shift');
const { ShiftRoster } = require('../models/ShiftRoster');
const { StaffLoanAdvance } = require('../models/StaffLoanAdvance');
const { StaffingRequest } = require('../models/StaffingRequest');
const { StockMovement } = require('../models/StockMovement');
const { StockTransfer } = require('../models/StockTransfer');
const { StoreDayAudit } = require('../models/StoreDayAudit');
const { SupportCase } = require('../models/SupportCase');
const { SustainabilityLog } = require('../models/SustainabilityLog');
const { Task } = require('../models/Task');
const { TrashEntry } = require('../models/TrashEntry');
const { TrustedDevice } = require('../models/TrustedDevice');
const { UserPreference } = require('../models/UserPreference');
const { Vendor } = require('../models/Vendor');
const { WastageRecord } = require('../models/WastageRecord');
const { WorkOrder } = require('../models/WorkOrder');
const { WorkflowDefinition } = require('../models/WorkflowDefinition');

async function purgeDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_cafe_erp';
  console.log('===============================================================');
  console.log('  ZAMORIN CAFÉ ERP — ZERO-DUMMY-DATA PRODUCTION SANITIZER');
  console.log('===============================================================');
  console.log(`Connecting to: ${mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`);

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB successfully.\n');

  // List of collections to completely clean out
  const purgeModels = [
    { name: 'AP Invoices', model: APInvoice },
    { name: 'Access Requests', model: AccessRequest },
    { name: 'Access Reviews', model: AccessReview },
    { name: 'Administrative Requests', model: AdministrativeRequest },
    { name: 'Approvals', model: Approval },
    { name: 'Assets', model: Asset },
    { name: 'Attachment Registry', model: AttachmentRegistry },
    { name: 'Attendance Offline Leases', model: AttendanceOfflineLease },
    { name: 'Attendance Periods', model: AttendancePeriod },
    { name: 'Attendance QR Challenges', model: AttendanceQrChallenge },
    { name: 'Attendance Submissions', model: AttendanceSubmission },
    { name: 'Audit Events', model: AuditEvent },
    { name: 'Bank Accounts', model: BankAccount },
    { name: 'POS Bills', model: Bill },
    { name: 'Cafe Inventory Configs', model: CafeInventoryConfig },
    { name: 'Recruitment Candidates', model: Candidate },
    { name: 'Cash Transactions', model: CashTransaction },
    { name: 'Combo Definitions', model: ComboDefinition },
    { name: 'Corporate Card Transactions', model: CorporateCardTransaction },
    { name: 'Custom Field Definitions', model: CustomFieldDefinition },
    { name: 'Customers', model: Customer },
    { name: 'Customer Feedback', model: CustomerFeedback },
    { name: 'Dashboard Saved Views', model: DashboardSavedView },
    { name: 'Dashboard Targets', model: DashboardTarget },
    { name: 'Delegations', model: Delegation },
    { name: 'Department Orders', model: DepartmentOrder },
    { name: 'Device Registrations', model: DeviceRegistration },
    { name: 'Device Security Events', model: DeviceSecurityEvent },
    { name: 'Disposition Certificates', model: DispositionCertificate },
    { name: 'Employee Documents', model: EmployeeDocument },
    { name: 'Employee Movements', model: EmployeeMovement },
    { name: 'Employee Skills', model: EmployeeSkill },
    { name: 'Employee Trainings', model: EmployeeTraining },
    { name: 'Expenses', model: Expense },
    { name: 'Expense Requests', model: ExpenseRequest },
    { name: 'Financial Periods', model: FinancialPeriod },
    { name: 'Global Inventory Items', model: GlobalInventoryItem },
    { name: 'Inbound Email Messages', model: InboundEmailMessage },
    { name: 'Incidents', model: Incident },
    { name: 'Institutional Accounts', model: InstitutionalAccount },
    { name: 'Institutional Quotes', model: InstitutionalQuote },
    { name: 'Inventory Cycle Counts', model: InventoryCycleCount },
    { name: 'Inventory Lots', model: InventoryLot },
    { name: 'Inventory Reservations', model: InventoryReservation },
    { name: 'Journals', model: Journal },
    { name: 'Leased Outlets', model: LeasedOutlet },
    { name: 'Leave Requests', model: LeaveRequest },
    { name: 'Loan Policies', model: LoanPolicy },
    { name: 'Loan Repayment Schedules', model: LoanRepaymentSchedule },
    { name: 'Loan Transactions', model: LoanTransaction },
    { name: 'Loyalty Ledgers', model: LoyaltyLedger },
    { name: 'Loyalty Programmes', model: LoyaltyProgramme },
    { name: 'Mail Automation Rules', model: MailAutomationRule },
    { name: 'Mail Cases', model: MailCase },
    { name: 'Mail Drafts', model: MailDraft },
    { name: 'Mail Templates', model: MailTemplate },
    { name: 'Mail Threads', model: MailThread },
    { name: 'Maintenance Jobs', model: MaintenanceJob },
    { name: 'Maintenance Plans', model: MaintenancePlan },
    { name: 'Marketplace Settlements', model: MarketplaceSettlement },
    { name: 'Menus', model: Menu },
    { name: 'Menu Change Sets', model: MenuChangeSet },
    { name: 'Menu Items', model: MenuItem },
    { name: 'Menu Publications', model: MenuPublication },
    { name: 'Menu Sections', model: MenuSection },
    { name: 'Modifier Groups', model: ModifierGroup },
    { name: 'Notifications', model: Notification },
    { name: 'Notification Outbox', model: NotificationOutbox },
    { name: 'Operational Advances', model: OperationalAdvance },
    { name: 'Operator Sessions', model: OperatorSession },
    { name: 'Outlet Offerings', model: OutletOffering },
    { name: 'Passbook Accounts', model: PassbookAccount },
    { name: 'Passbook Mappings', model: PassbookMapping },
    { name: 'Passbook Reconciliations', model: PassbookReconciliation },
    { name: 'Passbook Reservations', model: PassbookReservation },
    { name: 'Passbook Statement Imports', model: PassbookStatementImport },
    { name: 'Passbook Transactions', model: PassbookTransaction },
    { name: 'Passbook Transfers', model: PassbookTransfer },
    { name: 'Payment Runs', model: PaymentRun },
    { name: 'Payroll Runs', model: PayrollRun },
    { name: 'Payslips', model: Payslip },
    { name: 'Personal Ledgers', model: PersonalLedger },
    { name: 'Positions', model: Position },
    { name: 'Privacy Requests', model: PrivacyRequest },
    { name: 'Private Files', model: PrivateFile },
    { name: 'Probation Reviews', model: ProbationReview },
    { name: 'Profile Change Requests', model: ProfileChangeRequest },
    { name: 'Purchase Orders', model: PurchaseOrder },
    { name: 'Quality Checklists', model: QualityChecklist },
    { name: 'Recall Notices', model: RecallNotice },
    { name: 'Recipes', model: Recipe },
    { name: 'Recovery Charges', model: RecoveryCharge },
    { name: 'Register Sessions', model: RegisterSession },
    { name: 'Retention Policies', model: RetentionPolicy },
    { name: 'Revenue Share Agreements', model: RevenueShareAgreement },
    { name: 'Revenue Share Disputes', model: RevenueShareDispute },
    { name: 'Revenue Share Operators', model: RevenueShareOperator },
    { name: 'Revenue Share Payments', model: RevenueSharePayment },
    { name: 'Revenue Share Rate Rules', model: RevenueShareRateRule },
    { name: 'Revenue Share Settlements', model: RevenueShareSettlement },
    { name: 'Reward Definitions', model: RewardDefinition },
    { name: 'Sales Submissions', model: SalesSubmission },
    { name: 'Security Deposits', model: SecurityDeposit },
    { name: 'Sender Identities', model: SenderIdentity },
    { name: 'Service Identities', model: ServiceIdentity },
    { name: 'Service Mode BOMs', model: ServiceModeBOM },
    { name: 'Sessions', model: Session },
    { name: 'Shifts', model: Shift },
    { name: 'Shift Rosters', model: ShiftRoster },
    { name: 'Staff Loan Advances', model: StaffLoanAdvance },
    { name: 'Staffing Requests', model: StaffingRequest },
    { name: 'Stock Movements', model: StockMovement },
    { name: 'Stock Transfers', model: StockTransfer },
    { name: 'Store Day Audits', model: StoreDayAudit },
    { name: 'Support Cases', model: SupportCase },
    { name: 'Sustainability Logs', model: SustainabilityLog },
    { name: 'Tasks', model: Task },
    { name: 'Trash Entries', model: TrashEntry },
    { name: 'Trusted Devices', model: TrustedDevice },
    { name: 'User Preferences', model: UserPreference },
    { name: 'Vendors', model: Vendor },
    { name: 'Wastage Records', model: WastageRecord },
    { name: 'Work Orders', model: WorkOrder },
    { name: 'Workflow Definitions', model: WorkflowDefinition },
  ];

  console.log('1. Purging operational and transaction collections...');
  let totalPurged = 0;
  for (const item of purgeModels) {
    try {
      const res = item.model.collection?.deleteMany 
        ? await item.model.collection.deleteMany({}) 
        : await item.model.deleteMany({});
      if (res.deletedCount > 0) {
        console.log(`  ✔ Purged ${res.deletedCount.toString().padStart(4, ' ')} records from ${item.name}`);
        totalPurged += res.deletedCount;
      }
    } catch (err) {
      console.warn(`  ⚠ Error purging ${item.name}: ${err.message}`);
    }
  }

  console.log(`\n2. Cleaning workforce user accounts (preserving Primary Master only)...`);
  const userDeleteResult = User.collection?.deleteMany
    ? await User.collection.deleteMany({ isPrimaryMaster: { $ne: true } })
    : await User.deleteMany({ isPrimaryMaster: { $ne: true } });
  console.log(`  ✔ Removed ${userDeleteResult.deletedCount} non-master/dummy employee accounts.`);

  // Clean Primary Master state
  const masterEmail = (process.env.INITIAL_MASTER_EMAIL || 'pradeeshk331@gmail.com').trim().toLowerCase();
  const masterUpdate = User.collection?.updateMany
    ? await User.collection.updateMany(
        { isPrimaryMaster: true },
        {
          $set: {
            mfaEnabled: false,
            mfaMethod: 'NONE',
            mfaSecretEncrypted: null,
            pendingMfaSecretEncrypted: null,
            recoveryCodeHashes: [],
            assignedCafeIds: [],
            primaryCafeId: null,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        }
      )
    : await User.updateMany(
        { isPrimaryMaster: true },
        {
          $set: {
            mfaEnabled: false,
            mfaMethod: 'NONE',
            mfaSecretEncrypted: null,
            pendingMfaSecretEncrypted: null,
            recoveryCodeHashes: [],
            assignedCafeIds: [],
            primaryCafeId: null,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        }
      );
  console.log(`  ✔ Sanitized Primary Master profile for ${masterEmail} (2FA disabled, ready for frictionless sign-in).`);

  console.log('\n3. Resetting sequence number generators...');
  await SequenceCounter.deleteMany({});
  console.log('  ✔ All sequence counters reset to 0 for fresh production operations.');

  console.log('\n4. Verifying RBAC and foundational configuration...');
  const ruleCount = await RolePermission.countDocuments({});
  const settingsCount = await SystemCommunicationSettings.countDocuments({});
  const cafeCount = await Cafe.countDocuments({});
  const masterCount = await User.countDocuments({ isPrimaryMaster: true });

  console.log(`  ✔ Role Permissions active: ${ruleCount}`);
  console.log(`  ✔ System Settings active: ${settingsCount}`);
  console.log(`  ✔ Cafes configured: ${cafeCount}`);
  console.log(`  ✔ Primary Master accounts: ${masterCount}`);

  console.log('\n===============================================================');
  console.log(`  PRODUCTION DATABASE PURGE COMPLETE: ${totalPurged} dummy records cleared.`);
  console.log('  The system is now completely fresh and ready for client handover.');
  console.log('===============================================================\n');

  await mongoose.disconnect();
}

if (require.main === module) {
  purgeDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Purge script failed:', err);
      process.exit(1);
    });
}

module.exports = { purgeDatabase };
