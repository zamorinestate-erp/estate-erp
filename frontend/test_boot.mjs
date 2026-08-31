import { JSDOM } from "jsdom";

const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="app" class="auth-screen"></div><div id="toast-root"></div></body></html>`, {
  url: "http://localhost:3000/",
  runScripts: "dangerously"
});

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.sessionStorage = dom.window.sessionStorage;
global.location = dom.window.location;
global.navigator = dom.window.navigator;
global.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });

try {
  const main = await import("./src/js/main.js");
  console.log("main.js imported successfully!");
  console.log("DOM App Content length:", document.getElementById("app")?.innerHTML?.length);
  console.log("DOM App Content preview:", document.getElementById("app")?.innerHTML?.slice(0, 300));
} catch (err) {
  console.error("BOOT CRASH ERROR:", err);
}
