import { spawn } from 'child_process';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9226;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  await delay(1000);
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const list = await res.json();
  const pageTarget = list.find(t => t.type === 'page') || list[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  
  await new Promise(r => ws.onopen = r);
  
  let id = 1;
  function send(method, params = {}) {
    return new Promise(resolve => {
      const msgId = id++;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: 'http://localhost:3000/?role=staff#staff-home' });
  await delay(2000);

  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          title: document.title,
          url: window.location.href,
          bodyHtml: document.body.innerHTML.substring(0, 300),
          sidebarExists: !!document.getElementById('sidebar'),
          sidebarNavLinks: Array.from(document.querySelectorAll('.sidebar .nav-link')).map(b => b.textContent.trim()),
          scopePill: document.querySelector('.scope-pill')?.textContent.trim()
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Result:', evalRes.result?.value);

  ws.close();
  chrome.kill();
}

test().catch(console.error);
