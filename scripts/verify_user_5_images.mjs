import puppeteer from 'puppeteer-core';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function run() {
  console.log("Launching Chrome to verify user's 5 exact image scenarios...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const results = [];

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1 (Image 1): Inventory Transfers - Receive & Dispatch
    // -------------------------------------------------------------------------
    console.log("1. Testing Inventory Transfers (Receive & Dispatch)...");
    await page.goto("http://localhost:3000/?role=master#inventory/transfers", { waitUntil: "networkidle0" });
    await page.waitForSelector(".btn-dispatch-trf, .btn-receive-trf", { timeout: 8000 });

    // Click Dispatch on TRF-0089
    const dispatched = await page.evaluate(() => {
      const btn = document.querySelector('.btn-dispatch-trf[data-id="TRF-0089"]');
      if (btn) { btn.click(); return true; }
      return false;
    });
    await new Promise(r => setTimeout(r, 600));
    results.push({ scenario: 'Image 1: Dispatch button on TRF-0089', success: dispatched });

    // Click Receive on TRF-0091
    const received = await page.evaluate(() => {
      const btn = document.querySelector('.btn-receive-trf[data-id="TRF-0091"]');
      if (btn) { btn.click(); return true; }
      return false;
    });
    await new Promise(r => setTimeout(r, 600));
    const hasReceivedBadge = await page.evaluate(() => {
      return document.body.innerText.includes("✓ Received");
    });
    results.push({ scenario: 'Image 1: Receive button on TRF-0091 -> ✓ Received', success: received && hasReceivedBadge });

    // -------------------------------------------------------------------------
    // SCENARIO 2 (Image 2): Inventory Reservations - Release
    // -------------------------------------------------------------------------
    console.log("2. Testing Inventory Reservations (Release)...");
    await page.goto("http://localhost:3000/?role=master#inventory/reservations", { waitUntil: "networkidle0" });
    await page.waitForSelector(".btn-release-rsv", { timeout: 8000 });

    const released = await page.evaluate(() => {
      const btn = document.querySelector('.btn-release-rsv[data-id="RSV-0012"]');
      if (btn) { btn.click(); return true; }
      return false;
    });
    await new Promise(r => setTimeout(r, 600));
    results.push({ scenario: 'Image 2: Release reservation button on RSV-0012', success: released });

    // -------------------------------------------------------------------------
    // SCENARIO 3 (Image 3): Cycle Counts - Approve & Post
    // -------------------------------------------------------------------------
    console.log("3. Testing Physical Inventory Cycle Counts (Approve & Post)...");
    await page.goto("http://localhost:3000/?role=master#inventory/counts", { waitUntil: "networkidle0" });
    await page.waitForSelector(".btn-approve-count", { timeout: 8000 });

    const approved = await page.evaluate(() => {
      const btn = document.querySelector('.btn-approve-count[data-id="CNT-2026-0817"]');
      if (btn) { btn.click(); return true; }
      return false;
    });
    await new Promise(r => setTimeout(r, 600));
    const hasPostedBadge = await page.evaluate(() => {
      return document.body.innerText.includes("✓ Posted");
    });
    results.push({ scenario: 'Image 3: Approve & Post button on CNT-2026-0817 -> ✓ Posted', success: approved && hasPostedBadge });

    // -------------------------------------------------------------------------
    // SCENARIO 4 (Image 4): Maintenance Work Orders - Create & Update / Resolve
    // -------------------------------------------------------------------------
    console.log("4. Testing Equipment Work Orders (+ Create Work Order & Update / Resolve)...");
    await page.goto("http://localhost:3000/?role=master#assets/work_orders", { waitUntil: "networkidle0" });
    await page.waitForSelector("#open-create-wo-btn, #btn-child-new-wo, .update-wo-btn", { timeout: 8000 });

    // Test + Create Work Order modal
    await page.evaluate(() => {
      const btn = document.querySelector("#open-create-wo-btn") || document.querySelector("#btn-child-new-wo");
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));
    const createWoModal = await page.$('.modal-window, #wo-title');
    results.push({ scenario: 'Image 4: + Create Work Order modal open', success: createWoModal !== null });
    await page.evaluate(() => {
      const cancel = document.querySelector("#wo-cancel-btn") || document.querySelector(".modal-btn-cancel");
      if (cancel) cancel.click();
    });
    await new Promise(r => setTimeout(r, 300));

    // Test Update / Resolve button
    await page.evaluate(() => {
      const btn = document.querySelector('.update-wo-btn[data-id="WO-0001"]') || document.querySelector('.update-wo-btn');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));
    const updateWoModal = await page.$('#uwo-status');
    results.push({ scenario: 'Image 4: Update / Resolve work order modal open', success: updateWoModal !== null });
    // Authorize resolution
    await page.evaluate(() => {
      const submit = document.querySelector("#uwo-submit-btn");
      if (submit) submit.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // -------------------------------------------------------------------------
    // SCENARIO 5 (Image 5): Asset Inspections - + Record Inspection
    // -------------------------------------------------------------------------
    console.log("5. Testing Asset Inspections (+ Record Inspection)...");
    await page.goto("http://localhost:3000/?role=master#assets/inspections", { waitUntil: "networkidle0" });
    await page.waitForSelector("#btn-child-new-insp", { timeout: 8000 });

    await page.evaluate(() => {
      const btn = document.querySelector("#btn-child-new-insp");
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));
    const inspModal = await page.$('#insp-verdict');
    results.push({ scenario: 'Image 5: + Record Inspection modal open', success: inspModal !== null });
    // Save inspection
    await page.evaluate(() => {
      const submit = document.querySelector("#insp-submit-btn");
      if (submit) submit.click();
    });
    await new Promise(r => setTimeout(r, 400));

    console.log("\n============================================================");
    console.log("USER'S 5 SCREENSHOT SCENARIOS VERIFICATION TEST RESULTS:");
    console.log("============================================================");
    console.table(results);

    const allPassed = results.every(r => r.success);
    if (allPassed) {
      console.log("\n🎉 ALL 7 TEST CASES FOR THE 5 SCREENSHOTS PASSED WITH 100% SUCCESS!");
    } else {
      console.error("\n❌ SOME TESTS FAILED!");
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
