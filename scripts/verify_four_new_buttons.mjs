import puppeteer from 'puppeteer-core';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function run() {
  console.log("Launching Chrome to verify the 4 user-reported buttons...");
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
    // TEST 1: + Create Work Order (#assets/work-orders)
    // -------------------------------------------------------------------------
    console.log("1. Testing + Create Work Order...");
    await page.goto("http://localhost:3000/?role=master#assets/work-orders", { waitUntil: "networkidle0" });
    await page.waitForSelector("#btn-child-new-wo, #open-create-wo-btn", { timeout: 8000 });

    await page.evaluate(() => {
      const btn = document.querySelector("#btn-child-new-wo") || document.querySelector("#open-create-wo-btn");
      btn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    await page.evaluate(() => {
      document.querySelector("#wo-asset-id").value = "AST-001";
      document.querySelector("#wo-title").value = "Espresso Boiler Pressure Relief Valve Inspection";
      document.querySelector("#wo-description").value = "Boiler safety valve testing and gasket replacement";
      document.querySelector("#wo-submit-btn").click();
    });
    await new Promise(r => setTimeout(r, 500));

    const hasWorkOrder = await page.evaluate(() => {
      return document.body.innerText.includes("Espresso Boiler Pressure Relief Valve Inspection") && document.body.innerText.includes("WO-0002");
    });
    results.push({ test: 'Assets: + Create Work Order reflected in table', success: hasWorkOrder });

    // -------------------------------------------------------------------------
    // TEST 2: + Start Check (#quality/my-checks)
    // -------------------------------------------------------------------------
    console.log("2. Testing + Start Check...");
    await page.goto("http://localhost:3000/?role=master#quality/my-checks", { waitUntil: "networkidle0" });
    await page.waitForSelector("#btn-child-start-check, #mychecks-start-btn", { timeout: 8000 });

    await page.evaluate(() => {
      const btn = document.querySelector("#btn-child-start-check") || document.querySelector("#mychecks-start-btn");
      btn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Click Start on first template
    await page.evaluate(() => {
      const btn = document.querySelector("[data-start-tmpl]");
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Fill notes & complete inspection
    await page.evaluate(() => {
      const notes = document.querySelector("#modal-exec-notes");
      if (notes) notes.value = "Shift inspection performed by Head Barista";
      document.querySelector("#modal-exec-submit").click();
    });
    await new Promise(r => setTimeout(r, 500));

    const hasInspection = await page.evaluate(() => {
      return document.body.innerText.includes("QC-2026-0045") || document.body.innerText.includes("Shift inspection performed by Head Barista");
    });
    results.push({ test: 'Quality: + Start Check completed and reflected in log', success: hasInspection });

    // -------------------------------------------------------------------------
    // TEST 3: + New PRP Schedule (#quality/prp-fsms)
    // -------------------------------------------------------------------------
    console.log("3. Testing + New PRP Schedule...");
    await page.goto("http://localhost:3000/?role=master#quality/prp-fsms", { waitUntil: "networkidle0" });
    await page.waitForSelector("#btn-child-new-prp, #prp-new-btn", { timeout: 8000 });

    await page.evaluate(() => {
      const btn = document.querySelector("#btn-child-new-prp") || document.querySelector("#prp-new-btn");
      btn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    await page.evaluate(() => {
      document.querySelector("#modal-prp-title").value = "PRP 07: Barista Pitcher Rinse Sanitize Cycle";
      document.querySelector("#modal-prp-desc").value = "Periodic 4-hour hot steam purge and food-grade acid rinse";
      document.querySelector("#modal-prp-submit").click();
    });
    await new Promise(r => setTimeout(r, 500));

    const hasPrp = await page.evaluate(() => {
      return document.body.innerText.includes("Barista Pitcher Rinse Sanitize Cycle") && document.body.innerText.includes("Periodic 4-hour hot steam purge");
    });
    results.push({ test: 'Quality: + New PRP Schedule created and reflected in cards', success: hasPrp });

    // -------------------------------------------------------------------------
    // TEST 4: + Log Temperature (#quality/temperatures)
    // -------------------------------------------------------------------------
    console.log("4. Testing + Log Temperature...");
    await page.goto("http://localhost:3000/?role=master#quality/temperatures", { waitUntil: "networkidle0" });
    await page.waitForSelector("#btn-child-log-temp, #log-temp-btn", { timeout: 8000 });

    await page.evaluate(() => {
      const btn = document.querySelector("#btn-child-log-temp") || document.querySelector("#log-temp-btn");
      btn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    await page.evaluate(() => {
      document.querySelector("#modal-temp-reading").value = "2.4";
      document.querySelector("#modal-temp-notes").value = "Afternoon walk-in chiller inspection";
      document.querySelector("#modal-temp-save").click();
    });
    await new Promise(r => setTimeout(r, 500));

    const hasTemp = await page.evaluate(() => {
      return document.body.innerText.includes("2.4°C") && document.body.innerText.includes("TLOG-2026-085");
    });
    results.push({ test: 'Quality: + Log Temperature saved and reflected in table', success: hasTemp });

    console.log("\n============================================================");
    console.log("FOUR REPORTED BUTTONS VERIFICATION TEST RESULTS:");
    console.log("============================================================");
    console.table(results);

    const allPassed = results.every(r => r.success);
    if (allPassed) {
      console.log("\n🎉 ALL 4 USER-REPORTED BUTTONS PASSED WITH 100% SUCCESS!");
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
