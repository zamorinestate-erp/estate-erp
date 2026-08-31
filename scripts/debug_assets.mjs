import puppeteer from 'puppeteer-core';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  await page.goto("http://localhost:3000/?role=master#assets/work_orders", { waitUntil: "networkidle0" });
  await new Promise(r => setTimeout(r, 1000));

  const info = await page.evaluate(() => {
    return {
      hash: window.location.hash,
      bodyHtml: document.body.innerHTML.slice(0, 1000),
      buttons: Array.from(document.querySelectorAll('button')).map(b => ({ id: b.id, text: b.innerText, class: b.className }))
    };
  });

  console.log("DEBUG INFO:", JSON.stringify(info, null, 2));

  await browser.close();
}

run();
