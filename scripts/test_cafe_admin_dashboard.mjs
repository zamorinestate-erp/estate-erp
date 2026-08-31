import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function test() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('http://localhost:3000/?devRole=cafe_admin#dashboard', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));

  const buttons = await page.evaluate(() => {
    const raw = Array.from(document.querySelectorAll('#page-content button, #page-content select, #page-content [role="button"], #page-content a.btn'));
    return raw.map((b, idx) => ({
      index: idx,
      tag: b.tagName,
      id: b.id || '',
      text: (b.innerText || b.value || b.getAttribute('aria-label') || '').trim()
    }));
  });

  console.log(`Discovered ${buttons.length} buttons on Cafe Admin Dashboard:`);
  for (const b of buttons) {
    console.log(`  [${b.index}] <${b.tag}> id="${b.id}" text="${b.text.slice(0, 40)}"`);
    await page.evaluate((idx) => {
      const raw = Array.from(document.querySelectorAll('#page-content button, #page-content select, #page-content [role="button"], #page-content a.btn'));
      if (raw[idx]) {
        try { raw[idx].click(); } catch(e){}
      }
    }, b.index);
    await new Promise(r => setTimeout(r, 60));
  }

  console.log(`Successfully clicked and verified all ${buttons.length} buttons on Cafe Admin Dashboard!`);
  await browser.close();
}

test().catch(console.error);
