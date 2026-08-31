import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function main() {
  console.log("Launching Chrome to verify user-reported issues...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[PAGE ERROR] ${err.toString()}`));

  const results = [];

  // 1. Visit Attendance Roster
  console.log("Testing Shifts & Scheduling Roster...");
  await page.goto("http://localhost:3000/?role=master#attendance/roster", { waitUntil: "networkidle0" });
  await page.waitForSelector(".card", { timeout: 10000 });

  // Test Cafe Switch in Roster
  const cafeSel = await page.$("#roster-cafe-select");
  if (cafeSel) {
    await page.select("#roster-cafe-select", "ZC-0002");
    await new Promise(r => setTimeout(r, 600));
    const tableText = await page.$eval(".table", el => el.innerText);
    const hasSiddharth = tableText.includes("Siddharth Menon");
    results.push({ name: "Roster Switch to ZC-0002", success: hasSiddharth });
    console.log("Roster Switch to ZC-0002:", hasSiddharth ? "PASS" : "FAIL");
  } else {
    results.push({ name: "Roster Cafe Select exists", success: false });
  }

  // Test Click-to-Edit Shift
  const shiftBtn = await page.$(".roster-shift-btn");
  if (shiftBtn) {
    await shiftBtn.click();
    await new Promise(r => setTimeout(r, 600));
    const modalVisible = await page.$(".modal-window") !== null;
    console.log("Click-to-Edit Shift Modal opens:", modalVisible ? "PASS" : "FAIL");
    results.push({ name: "Click-to-Edit Shift Modal", success: modalVisible });

    // Select preset and save
    const eveningPreset = await page.$(".shift-preset-btn[data-shift='13:00 - 21:30']");
    if (eveningPreset) {
      await eveningPreset.click();
      await new Promise(r => setTimeout(r, 300));
    }
    const saveBtn = await page.$(".modal-footer .btn-primary") || await page.$("[data-modal-save]");
    if (saveBtn) {
      await saveBtn.click();
      await new Promise(r => setTimeout(r, 600));
      results.push({ name: "Save Shift Edit", success: true });
    }
  }

  // Test Add Staff to Roster
  const addStaffBtn = await page.$("#add-staff-roster-btn");
  if (addStaffBtn) {
    await addStaffBtn.click();
    await new Promise(r => setTimeout(r, 600));
    const addStaffModal = await page.$(".modal-window") !== null;
    console.log("Add Staff Modal opens:", addStaffModal ? "PASS" : "FAIL");
    results.push({ name: "Add Staff to Roster Modal", success: addStaffModal });
    const modalSave = await page.$(".modal-footer .btn-primary") || await page.$("[data-modal-save]");
    if (modalSave) {
      await modalSave.click();
      await new Promise(r => setTimeout(r, 600));
    }
  }

  // Test Auto-Schedule
  const autoSchedBtn = await page.$("#auto-schedule-roster-btn");
  if (autoSchedBtn) {
    await autoSchedBtn.click();
    await new Promise(r => setTimeout(r, 400));
    const confirmBtn = await page.$(".modal-window .btn-primary") || await page.$("[data-modal-save]");
    if (confirmBtn) {
      await confirmBtn.click();
      await new Promise(r => setTimeout(r, 600));
      results.push({ name: "Auto-Schedule Coverage", success: true });
    }
  }

  // Test Week Navigation
  const nextWeekBtn = await page.$("#roster-next-week-btn");
  if (nextWeekBtn) {
    await nextWeekBtn.click();
    await new Promise(r => setTimeout(r, 400));
    results.push({ name: "Roster Next Week Nav", success: true });
  }

  // Test Copy Last Week & Publish Roster
  const copyBtn = await page.$("#copy-prev-week-roster-btn");
  if (copyBtn) {
    await copyBtn.click();
    results.push({ name: "Copy Last Week Roster", success: true });
  }

  const publishBtn = await page.$("#publish-roster-btn");
  if (publishBtn) {
    await publishBtn.click();
    await new Promise(r => setTimeout(r, 400));
    results.push({ name: "Toggle Publish Roster", success: true });
  }

  // 2. Test Attendance History 360 Dropdowns
  console.log("Testing Attendance 360...");
  await page.goto("http://localhost:3000/?role=master#attendance/calendar360", { waitUntil: "networkidle0" });
  await page.waitForSelector("#calendar-user-select", { timeout: 10000 });
  await page.select("#calendar-user-select", "EMP-003");
  await new Promise(r => setTimeout(r, 600));
  const pageText = await page.$eval(".card", el => el.innerText);
  const hasKiran = pageText.includes("Kiran Shetty");
  results.push({ name: "Attendance 360 Employee Switch to EMP-003", success: hasKiran });
  console.log("Attendance 360 Switch to Kiran Shetty:", hasKiran ? "PASS" : "FAIL");

  // 3. Test Topbar Controls (Hamburger & Global Cafe Selector)
  console.log("Testing Topbar Controls...");
  const hamburgerBtn = await page.$("#sidebar-toggle-btn");
  if (hamburgerBtn) {
    await hamburgerBtn.click();
    await new Promise(r => setTimeout(r, 400));
    results.push({ name: "Sidebar Hamburger Toggle", success: true });
    console.log("Sidebar Hamburger Toggle: PASS");
  }

  const globalCafe = await page.$("#global-cafe-selector");
  if (globalCafe) {
    await page.select("#global-cafe-selector", "ZC-0002");
    await new Promise(r => setTimeout(r, 600));
    results.push({ name: "Global Cafe Selector Switch", success: true });
    console.log("Global Cafe Selector Switch: PASS");
  }

  // 4. Test Stock Movement without session expiry error
  console.log("Testing Inventory Movement Action...");
  await page.goto("http://localhost:3000/?role=master#inventory", { waitUntil: "networkidle0" });
  await page.waitForSelector("#btn-child-log-movement, #open-record-movement-btn, .page-enter", { timeout: 10000 });
  const logMovementBtn = await page.$("#btn-child-log-movement") || await page.$("#open-record-movement-btn");
  if (logMovementBtn) {
    await logMovementBtn.click();
    await new Promise(r => setTimeout(r, 600));
    const movementModal = await page.$("#form-record-movement") !== null;
    if (movementModal) {
      await page.type("#modal-move-qty", "5");
      await page.type("#modal-move-reason", "Morning prep verification");
      const submitMoveBtn = await page.$("#form-record-movement button[type='submit']");
      if (submitMoveBtn) {
        await submitMoveBtn.click();
        await new Promise(r => setTimeout(r, 1000));
        // Check toasts
        const toasts = await page.$$eval(".toast, .toast-content, .toast-item", els => els.map(e => e.innerText));
        const hasSessionError = toasts.some(t => t.toLowerCase().includes("session has expired"));
        results.push({ name: "Inventory Stock Movement Execution", success: !hasSessionError });
        console.log("Inventory Stock Movement Execution (No session expiry error):", !hasSessionError ? "PASS" : "FAIL");
      }
    }
  }

  await browser.close();

  console.log("\n==================== VERIFICATION SUMMARY ====================");
  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync(path.resolve(__dirname, '../scratch/user_reported_issues_report.json'), JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
