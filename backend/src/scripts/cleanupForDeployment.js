/**
 * ZAMORIN CAFE ERP — PRODUCTION PRE-DEPLOYMENT DATA CLEANUP
 * Removes ALL fake/seed/test data. Preserves only:
 *   - Primary Master user: pradeeshk331@gmail.com
 *   - role_permissions (136 canonical rules)
 *   - system_communication_settings
 */
"use strict";
const mongoose = require("mongoose");
require("dotenv/config");

const PRIMARY_MASTER_EMAIL = "pradeeshk331@gmail.com";
const ORG_ID = "ZAMORIN";

async function run() {
  console.log("=".repeat(60));
  console.log("ZAMORIN ERP — PRODUCTION DATA CLEANUP");
  console.log("=".repeat(60));

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // Guard: confirm Primary Master exists before touching anything
  const primaryMaster = await db.collection("users").findOne({
    organisationId: ORG_ID,
    email: PRIMARY_MASTER_EMAIL,
    isPrimaryMaster: true,
  });

  if (!primaryMaster) {
    console.error("ABORT: Primary Master not found. Nothing was deleted.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const del = async (col, filter = {}, label) => {
    const r = await db.collection(col).deleteMany(filter);
    console.log(`[${label || col}] Deleted ${r.deletedCount} docs`);
    return r.deletedCount;
  };

  // Users: delete all except Primary Master
  await del("users", { _id: { $ne: primaryMaster._id } }, "users (fake/test)");

  // Sessions & Auth
  await del("sessions");
  await del("password_reset_challenges");

  // Audit
  await del("audit_events");

  // Menu
  await del("menus");
  await del("menu_items");
  await del("menu_sections");
  await del("menu_publications");
  await del("menu_change_sets");
  await del("modifier_groups");
  await del("recipes");
  await del("combo_definitions");
  await del("outlet_offerings");

  // Positions
  await del("positions");

  // Inventory
  await del("inventorylots");
  await del("stockmovements");
  await del("cafeinventoryconfigs");
  await del("globalinventoryitems");
  await del("inventoryreservations");
  await del("stocktransfers");
  await del("inventorycyclecounts");

  // Finance
  await del("chartofaccounts");
  await del("bankaccounts");
  await del("institutional_accounts");
  await del("financialperiods");
  await del("journals");
  await del("cash_transactions");
  await del("passbook_transactions");
  await del("passbook_accounts");
  await del("passbook_mappings");
  await del("passbook_reconciliations");
  await del("passbook_transfers");
  await del("passbook_reservations");
  await del("passbook_statement_imports");
  await del("personal_ledger_entries");
  await del("corporate_card_transactions");
  await del("revenue_share_payments");
  await del("revenue_share_disputes");
  await del("revenue_share_settlements");
  await del("revenue_share_rate_rules");
  await del("revenue_share_agreements");
  await del("revenue_share_operators");
  await del("marketplacesettlements");
  await del("recovery_charges");
  await del("security_deposits");
  await del("institutional_quotes");
  await del("apinvoices");

  // Operational
  await del("department_orders");
  await del("storedayaudits");
  await del("expense_policies");
  await del("expense_requests");
  await del("expenses");
  await del("bills");
  await del("loan_policies");
  await del("staff_loans_advances");
  await del("loan_transactions");
  await del("loan_repayment_schedules");
  await del("operational_advances");
  await del("payroll_runs");
  await del("payslips");
  await del("attendance");
  await del("attendance_periods");
  await del("attendance_submissions");
  await del("attendance_offline_leases");
  await del("attendance_qr_challenges");
  await del("shift_rosters");
  await del("leaverequests");
  await del("approvals");
  await del("tasks");
  await del("quality_checklists");
  await del("wastagerecords");
  await del("incidents");
  await del("work_orders");
  await del("maintenance_plans");
  await del("maintenance_jobs");
  await del("assets");
  await del("purchase_orders");

  // People / HR
  await del("staffingrequests");
  await del("candidates");
  await del("probationreviews");
  await del("accessreviews");
  await del("delegations");
  await del("employeedocuments");
  await del("employeetrainings");
  await del("employeemovements");
  await del("employeeskills");
  await del("profilechangerequests");
  await del("administrativerequests");
  await del("user_preferences");

  // Customers & Loyalty
  await del("customers");
  await del("customer_feedbacks");
  await del("loyalty_programmes");
  await del("loyalty_ledger");
  await del("reward_definitions");

  // Vendors & Procurement
  await del("vendors");

  // Cafes
  await del("cafes");
  await del("leased_outlets");

  // Sales & POS
  await del("sales_submissions");
  await del("bills");
  await del("registersessions");

  // Devices
  await del("device_registrations");
  await del("cafeopsdevices");
  await del("cafeopsdeviceenrollmenttokens");
  await del("cafeopsoperatoraccesses");
  await del("cafeopsoperatorcredentials");
  await del("cafeopssessions");
  await del("cafeopssecurityevents");

  // Notifications & Comms
  await del("notification_outbox");
  await del("notifications");
  await del("mailtemplates");
  await del("mailthreads");
  await del("maildrafts");
  await del("mailcases");
  await del("mailautomationrules");
  await del("senderidentities");
  await del("inbound_email_messages");

  // Other
  await del("support_cases");
  await del("dashboard_saved_views");
  await del("dashboard_targets");
  await del("access_requests");
  await del("trash_entries");
  await del("sustainability_logs");
  await del("private_files");
  await del("attachment_registries");
  await del("privacy_requests");
  await del("retention_policies");
  await del("recallnotices");
  await del("disposition_certificates");
  await del("custom_field_definitions");
  await del("workflow_definitions");
  await del("change_stream_checkpoints");

  // Sequence counters — reset so IDs start fresh on first real use
  await del("sequence_counters");

  console.log("");
  console.log("=".repeat(60));
  console.log("PRESERVED:");
  console.log("  users.Primary Master =>", PRIMARY_MASTER_EMAIL);
  console.log("  role_permissions     => 136 canonical rules (untouched)");
  console.log("  system_communication_settings (untouched)");
  console.log("=".repeat(60));
  console.log("DATABASE IS CLEAN AND READY FOR HANDOVER.");
  console.log("=".repeat(60));

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("CLEANUP FAILED:", err.message);
  process.exit(1);
});
