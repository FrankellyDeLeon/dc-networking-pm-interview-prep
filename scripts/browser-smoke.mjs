#!/usr/bin/env node
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const url = process.argv.find((argument) => argument.startsWith("http")) || "http://127.0.0.1:8000/";
const screenshotFlag = process.argv.indexOf("--screenshot");
const screenshotPath = screenshotFlag >= 0 ? process.argv[screenshotFlag + 1] : null;
const candidates = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "google-chrome",
  "chromium",
  "chromium-browser"
].filter(Boolean);

if (typeof WebSocket !== "function") {
  throw new Error("Browser smoke test requires a Node.js runtime with the standard WebSocket API (Node 22+).");
}

async function executable(candidatesToCheck) {
  for (const candidate of candidatesToCheck) {
    if (!candidate.includes("/")) return candidate;
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next known browser path.
    }
  }
  throw new Error("No Chrome, Edge, or Chromium executable found. Set CHROME_BIN to run the browser smoke test.");
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

class DevTools {
  constructor(websocketUrl) {
    this.socket = new WebSocket(websocketUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.exceptions = [];
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        if (message.error) request.reject(new Error(`${request.method}: ${message.error.message}`));
        else request.resolve(message.result);
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        this.exceptions.push(message.params.exceptionDetails.text || "Uncaught browser exception");
      }
    });
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", () => reject(new Error("DevTools WebSocket connection failed")), {
        once: true
      });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  }
}

const profile = await mkdtemp(path.join(os.tmpdir(), "dcn-prep-browser-"));
const browserPath = await executable(candidates);
const browser = spawn(
  browserPath,
  [
    "--headless=new",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    url
  ],
  { stdio: ["ignore", "ignore", "pipe"] }
);
const browserExit = new Promise((resolve) => browser.once("exit", resolve));

let stderr = "";
browser.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

try {
  const activePortFile = path.join(profile, "DevToolsActivePort");
  let activePort;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      activePort = (await readFile(activePortFile, "utf8")).split(/\r?\n/)[0];
      if (activePort) break;
    } catch {
      // Chrome creates this file after its DevTools endpoint is ready.
    }
    await delay(100);
  }
  assert(activePort, `Chrome DevTools did not start.\n${stderr.trim()}`);

  let targets = [];
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await fetch(`http://127.0.0.1:${activePort}/json/list`);
    targets = await response.json();
    if (targets.some((target) => target.type === "page")) break;
    await delay(100);
  }
  const page = targets.find((target) => target.type === "page");
  assert(page?.webSocketDebuggerUrl, "No debuggable page target was available.");

  const devtools = new DevTools(page.webSocketDebuggerUrl);
  await devtools.open();
  await devtools.send("Runtime.enable");
  await devtools.send("Page.enable");

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await devtools.evaluate("document.readyState")) === "complete") break;
    await delay(100);
  }
  await delay(250);

  const initial = await devtools.evaluate(`(() => ({
    title: document.title,
    cards: document.querySelectorAll("[data-filter-item]").length,
    sections: document.querySelectorAll("main section[id]").length,
    sources: document.querySelectorAll(".source-entry").length,
    sourceTitles: document.querySelectorAll(".source-entry .source-title").length,
    sourceSupport: document.querySelectorAll(".source-entry .source-support").length,
    sourceUrls: document.querySelectorAll(".source-entry a.source-url[href^='https://']").length,
    status: document.querySelector("#filter-status")?.textContent,
    skip: document.querySelector(".skip-link")?.getAttribute("href"),
    theme: document.documentElement.dataset.theme,
    readiness: document.querySelector("#readiness-ring")?.getAttribute("aria-label"),
    h1Count: document.querySelectorAll("h1").length,
    unnamedButtons: [...document.querySelectorAll("button")].filter((button) => !button.textContent.trim() && !button.getAttribute("aria-label")).length,
    unlabelledFields: [...document.querySelectorAll("input, select")].filter((field) => {
      const labels = field.labels ? [...field.labels] : [];
      return labels.length === 0 && !field.getAttribute("aria-label");
    }).length,
    externalRuntimeResources: performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((resource) => new URL(resource).origin !== location.origin)
  }))()`);
  assert(initial.title.includes("DC Networking"), "Expected page title was not rendered.");
  assert(initial.cards >= 50, `Expected at least 50 filterable cards; found ${initial.cards}.`);
  assert(initial.sections >= 23, `Expected at least 23 main sections; found ${initial.sections}.`);
  assert(initial.sources >= 20, `Expected at least 20 rendered source entries; found ${initial.sources}.`);
  assert(
    initial.sourceTitles === initial.sources &&
      initial.sourceSupport === initial.sources &&
      initial.sourceUrls >= initial.sources,
    `Rendered source register is incomplete: ${initial.sourceTitles} titles, ${initial.sourceSupport} support notes, and ${initial.sourceUrls} URLs for ${initial.sources} entries.`
  );
  assert(initial.status?.includes("preparation cards shown"), "Application initialization status is missing.");
  assert(initial.skip === "#main-content", "Skip link target is incorrect.");
  assert(initial.theme === "light", "Fresh browser profile should initialize the declared light theme.");
  assert(initial.readiness?.startsWith("0% ready"), "Fresh browser profile should initialize readiness at zero.");
  assert(initial.h1Count === 1, `Expected one page-level h1; found ${initial.h1Count}.`);
  assert(initial.unnamedButtons === 0, `Found ${initial.unnamedButtons} unnamed buttons.`);
  assert(initial.unlabelledFields === 0, `Found ${initial.unlabelledFields} unlabelled form fields.`);
  assert(initial.externalRuntimeResources.length === 0, `External runtime resources loaded: ${initial.externalRuntimeResources.join(", ")}`);

  const skipLink = await devtools.evaluate(`(() => {
    const link = document.querySelector(".skip-link");
    link.focus();
    const rect = link.getBoundingClientRect();
    return { active: document.activeElement === link, top: rect.top, bottom: rect.bottom };
  })()`);
  assert(skipLink.active && skipLink.bottom > 0, "Skip link was not visible when focused.");

  const filtered = await devtools.evaluate(`(() => {
    const input = document.querySelector("#site-search");
    input.value = "RoCE";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return {
      hidden: document.querySelectorAll("[data-filter-item].is-filtered").length,
      visible: [...document.querySelectorAll("[data-filter-item]")].filter((item) => !item.classList.contains("is-filtered")).length,
      status: document.querySelector("#filter-status").textContent
    };
  })()`);
  assert(filtered.hidden > 0 && filtered.visible > 0, "Search did not produce a mixed visible/hidden result.");
  assert(filtered.status.startsWith(String(filtered.visible)), "Search status did not report the visible count.");

  const cleared = await devtools.evaluate(`(() => {
    document.querySelector("#clear-filter").click();
    return {
      query: document.querySelector("#site-search").value,
      hidden: document.querySelectorAll("[data-filter-item].is-filtered").length
    };
  })()`);
  assert(cleared.query === "" && cleared.hidden === 0, "Clear filter did not restore all cards.");

  const selected = await devtools.evaluate(`(() => {
    const select = document.querySelector("#category-filter");
    select.value = "commercial";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return {
      hidden: document.querySelectorAll("[data-filter-item].is-filtered").length,
      visible: [...document.querySelectorAll("[data-filter-item]")].filter((item) => !item.classList.contains("is-filtered")).length
    };
  })()`);
  assert(selected.hidden > 0 && selected.visible > 0, "Category filter did not produce a mixed result.");
  await devtools.evaluate('document.querySelector("#clear-filter").click()');

  const themed = await devtools.evaluate(`(() => {
    document.querySelector("#theme-toggle").click();
    return {
      theme: document.documentElement.dataset.theme,
      pressed: document.querySelector("#theme-toggle").getAttribute("aria-pressed"),
      stored: localStorage.getItem("dcn-prep-theme")
    };
  })()`);
  assert(themed.theme === "dark" && themed.pressed === "true" && themed.stored === "dark", "Theme toggle did not persist dark mode.");

  const progressed = await devtools.evaluate(`(() => {
    const first = document.querySelector("[data-progress]");
    first.click();
    return {
      checked: first.checked,
      label: document.querySelector("#readiness-ring").getAttribute("aria-label"),
      stored: localStorage.getItem("dcn-prep-progress")
    };
  })()`);
  assert(progressed.checked && !progressed.label.startsWith("0%"), "Readiness interaction did not update the meter.");
  assert(progressed.stored?.includes("true"), "Readiness interaction did not persist locally.");

  const expanded = await devtools.evaluate(`(() => {
    document.querySelectorAll("details.card").forEach((item) => { item.open = false; });
    const button = document.querySelector("#expand-toggle");
    button.dataset.action = "expand";
    button.click();
    const details = [...document.querySelectorAll("details.card")];
    return { open: details.filter((item) => item.open).length, total: details.length };
  })()`);
  assert(expanded.total > 10 && expanded.open === expanded.total, "Expand-all interaction did not open every visible details card.");

  await devtools.evaluate('location.hash = "#star-cisco-live"');
  await delay(100);
  const hashTarget = await devtools.evaluate(`(() => ({
    exists: Boolean(document.querySelector("#star-cisco-live")),
    open: document.querySelector("#star-cisco-live")?.open
  }))()`);
  assert(hashTarget.exists && hashTarget.open, "Deep link did not expose the nested STAR target.");

  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  const mobile = await devtools.evaluate(`(() => ({
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    layout: getComputedStyle(document.querySelector(".layout")).display,
    heroColumns: getComputedStyle(document.querySelector(".hero")).gridTemplateColumns,
    tocCard: getComputedStyle(document.querySelector(".toc-card")).display,
    tocOverflow: getComputedStyle(document.querySelector(".toc")).overflowX
  }))()`);
  assert(mobile.scrollWidth <= mobile.viewport + 1, `Mobile layout overflows horizontally (${mobile.scrollWidth} > ${mobile.viewport}).`);
  assert(mobile.layout === "block", "Mobile breakpoint did not collapse the main layout.");
  assert(mobile.tocCard !== "none" && mobile.tocOverflow === "auto", "Mobile in-page navigation is not available.");

  await devtools.evaluate('document.querySelector("[data-filter-item]").classList.add("is-filtered")');
  await devtools.send("Emulation.setEmulatedMedia", { media: "print" });
  const print = await devtools.evaluate(`(() => ({
    topbar: getComputedStyle(document.querySelector(".topbar")).display,
    sidebar: getComputedStyle(document.querySelector(".sidebar")).display,
    detailsVisible: getComputedStyle(document.querySelector("details.card .details-body")).display,
    filteredVisible: getComputedStyle(document.querySelector("[data-filter-item].is-filtered")).display,
    disclaimer: getComputedStyle(document.querySelector(".disclaimer")).display
  }))()`);
  assert(print.topbar === "none" && print.sidebar === "none", "Print stylesheet did not hide interactive navigation.");
  assert(print.detailsVisible !== "none", "Print stylesheet did not expose details content.");
  assert(print.filteredVisible !== "none", "Print stylesheet preserved an active screen filter.");
  assert(print.disclaimer !== "none", "Print stylesheet omitted the independence disclaimer.");
  await devtools.evaluate('document.querySelector("[data-filter-item].is-filtered").classList.remove("is-filtered")');
  const cheatPrint = await devtools.evaluate(`(() => {
    document.body.classList.add("print-cheat-only");
    return {
      dashboard: getComputedStyle(document.querySelector("#call-dashboard")).display,
      cheat: getComputedStyle(document.querySelector("#cheat-sheet")).display
    };
  })()`);
  assert(cheatPrint.dashboard === "none" && cheatPrint.cheat !== "none", "Cheat-sheet-only print mode did not isolate the sheet.");
  const cheatPdf = await devtools.send("Page.printToPDF", {
    printBackground: true,
    preferCSSPageSize: true
  });
  const cheatPages = (Buffer.from(cheatPdf.data, "base64").toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
  assert(cheatPages === 1, `Cheat sheet rendered to ${cheatPages} print pages instead of one.`);
  await devtools.evaluate('document.body.classList.remove("print-cheat-only")');
  await devtools.send("Emulation.setEmulatedMedia", { media: "screen" });
  await devtools.send("Emulation.clearDeviceMetricsOverride");

  if (screenshotPath) {
    await devtools.evaluate(`(() => {
      localStorage.clear();
      history.replaceState(null, "", location.pathname);
      location.reload();
    })()`);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        if ((await devtools.evaluate("document.readyState")) === "complete") break;
      } catch {
        // The execution context is briefly unavailable during reload.
      }
      await delay(100);
    }
    await delay(250);
    await devtools.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    });
    await devtools.evaluate("scrollTo(0, 0)");
    await delay(100);
    const capture = await devtools.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      fromSurface: true
    });
    await writeFile(path.resolve(screenshotPath), Buffer.from(capture.data, "base64"));
  }

  assert(devtools.exceptions.length === 0, `Browser raised exceptions: ${devtools.exceptions.join("; ")}`);
  await devtools.send("Browser.close");
  console.log(
    `Browser smoke passed: ${initial.cards} cards, search/category/theme/progress/expand/deep-link interactions, ` +
      "mobile layout, print layout, and no uncaught exceptions."
  );
} finally {
  if (browser.exitCode === null && browser.signalCode === null) browser.kill("SIGTERM");
  await Promise.race([browserExit, delay(5_000)]);
  let cleanupError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await rm(profile, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
      cleanupError = null;
      break;
    } catch (error) {
      cleanupError = error;
      await delay(100);
    }
  }
  if (cleanupError) throw cleanupError;
}
