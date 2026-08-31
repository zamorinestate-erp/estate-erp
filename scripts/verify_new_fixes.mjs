import puppeteer from 'puppeteer-core';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function run() {
  console.log("Launching Chrome to verify Procurement buttons and Asset Wizard reflection...");
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
    // TEST 1: Register New Asset Wizard (Name: "hii")
    // -------------------------------------------------------------------------
    console.log("1. Testing Register New Asset Wizard (reflection of asset named 'hii')...");
    await page.goto("http://localhost:3000/?role=master#assets/assets", { waitUntil: "networkidle0" });
    await page.waitForSelector("#btn-child-reg-asset", { timeout: 8000 });

    // Click + Register New Asset
    await page.evaluate(() => document.querySelector("#btn-child-reg-asset").click());
    await new Promise(r => setTimeout(r, 400));

    // Step 1: Input "hii"
    await page.evaluate(() => {
      document.querySelector("#wiz-asset-name").value = "hii";
      document.querySelector("#wiz-asset-category").value = "REFRIGERATION";
      document.querySelector("#wiz-next-btn").click();
    });
    await new Promise(r => setTimeout(r, 300));

    // Step 2: Click Continue
    await page.evaluate(() => document.querySelector("#wiz-next-btn").click());
    await new Promise(r => setTimeout(r, 300));

    // Step 3: Click Continue
    await page.evaluate(() => document.querySelector("#wiz-next-btn").click());
    await new Promise(r => setTimeout(r, 300));

    // Step 4: Click Continue
    await page.evaluate(() => document.querySelector("#wiz-next-btn").click());
    await new Promise(r => setTimeout(r, 300));

    // Step 5: Click Register Asset
    await page.evaluate(() => document.querySelector("#wiz-submit-btn").click());
    await new Promise(r => setTimeout(r, 600));

    // Verify "hii" appears in the asset table
    const hasHiiAsset = await page.evaluate(() => {
      return document.body.innerText.includes("hii") && document.body.innerText.includes("REFRIGERATION");
    });
    results.push({ test: 'Asset Wizard: "hii" registered and reflected in table', success: hasHiiAsset });

    // -------------------------------------------------------------------------
    // TEST 2: Blanket Agreement (+ Blanket Agreement)
    // -------------------------------------------------------------------------
    console.log("2. Testing Procurement: + Blanket Agreement...");
    await page.goto("http://localhost:3000/?role=master#procurement/agreements", { waitUntil: "networkidle0" });
    await page.waitForSelector("#btn-child-new-agr", { timeout: 8000 });

    await page.evaluate(() => document.querySelector("#btn-child-new-agr").click());
    await new Promise(r => setTimeout(r, 400));

    await page.evaluate(() => {
      document.querySelector("#modal-bpa-vendor").value = "Malabar Special Roasters";
      document.querySelector("#modal-bpa-amount").value = "2500000";
      document.querySelector("#modal-bpa-submit").click();
    });
    await new Promise(r => setTimeout(r, 500));

    const hasBpa = await page.evaluate(() => {
      return document.body.innerText.includes("Malabar Special Roasters") && document.body.innerText.includes("BPA-2026-004");
    });
    results.push({ test: 'Procurement: + Blanket Agreement created and reflected in table', success: hasBpa });

    // -------------------------------------------------------------------------
    // TEST 3: Intake GRN (+ Intake GRN)
    // -------------------------------------------------------------------------
    console.log("3. Testing Procurement: + Intake GRN...");
    await page.goto("http://localhost:3000/?role=master#procurement/receiving", { waitUntil: "networkidle0" });
    await page.waitForSelector("#btn-child-new-grn", { timeout: 8000 });

    await page.evaluate(() => document.querySelector("#btn-child-new-grn").click());
    await new Promise(r => setTimeout(r, 400));

    await page.evaluate(() => {
      document.querySelector("#modal-dgrn-po").value = "PO-2026-0099";
      document.querySelector("#modal-dgrn-dc").value = "DC-TEST-123";
      document.querySelector("#modal-dgrn-submit").click();
    });
    await new Promise(r => setTimeout(r, 500));

    const hasGrn = await page.evaluate(() => {
      return document.body.innerText.includes("PO-2026-0099");
    });
    results.push({ test: 'Procurement: + Intake GRN created and reflected in table', success: hasGrn });

    // -------------------------------------------------------------------------
    // TEST 4: Add Supplier (+ Add Supplier)
    // -------------------------------------------------------------------------
    console.log("4. Testing Procurement: + Add Supplier...");
    await page.goto("http://localhost:3000/?role=master#procurement/suppliers", { waitUntil: "networkidle0" });
    await page.waitForSelector("#btn-child-new-supp", { timeout: 8000 });

    await page.evaluate(() => document.querySelector("#btn-child-new-supp").click());
    await new Promise(r => setTimeout(r, 400));

    await page.evaluate(() => {
      document.querySelector("#modal-supp-name").value = "Calicut Spices & Roastery LLP";
      document.querySelector("#modal-supp-submit").click();
    });
    await new Promise(r => setTimeout(r, 500));

    const hasSupp = await page.evaluate(() => {
      return document.body.innerText.includes("Calicut Spices & Roastery LLP");
    });
    results.push({ test: 'Procurement: + Add Supplier created and reflected in table', success: hasSupp });

    // -------------------------------------------------------------------------
    // TEST 5: Record Return (+ Record Return)
    // -------------------------------------------------------------------------
    console.log("5. Testing Procurement: + Record Return...");
    await page.goto("http://localhost:3000/?role=master#procurement/exceptions", { waitUntil: "networkidle0" });
    await page.waitForSelector("#btn-child-new-ret", { timeout: 8000 });

    await page.evaluate(() => document.querySelector("#btn-child-new-ret").click());
    await new Promise(r => setTimeout(r, 400));

    await page.evaluate(() => {
      document.querySelector("#modal-rtv-ref").value = "GRN-2026-9999";
      document.querySelector("#modal-rtv-submit").click();
    });
    await new Promise(r => setTimeout(r, 500));

    const hasReturn = await page.evaluate(() => {
      return document.body.innerText.includes("GRN-2026-9999") && document.body.innerText.includes("DEBIT_NOTE_ISSUED");
    });
    results.push({ test: 'Procurement: + Record Return created and reflected in table', success: hasReturn });

    console.log("\n============================================================");
    console.log("NEW FIXES VERIFICATION TEST RESULTS:");
    console.log("============================================================");
    console.table(results);

    const allPassed = results.every(r => r.success);
    if (allPassed) {
      console.log("\n🎉 ALL 5 TEST CASES PASSED WITH 100% SUCCESS!");
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
