#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const errors = [];
const warnings = [];
const requiredFiles = ["index.html", "styles.css", "app.js", "README.md"];
const requiredSections = [
  "call-dashboard",
  "role-traceability",
  "manager-brief",
  "candidate-positioning",
  "customer-workloads",
  "fabric-foundations",
  "ethernet-ai",
  "enterprise-fabrics",
  "security",
  "cisco-portfolio",
  "optics-silicon",
  "competitive-landscape",
  "reference-architectures",
  "design-lab",
  "product-craft",
  "commercial",
  "launch-lifecycle",
  "interview-bank",
  "star-bank",
  "gap-plan",
  "cheat-sheet",
  "source-register",
  "privacy-integrity"
];

const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

const files = {};
for (const file of requiredFiles) {
  try {
    files[file] = await readFile(path.join(root, file), "utf8");
  } catch {
    fail(`Missing required file: ${file}`);
    files[file] = "";
  }
}

const html = files["index.html"];
const readme = files["README.md"];

if (!/^<!doctype html>/i.test(html.trimStart())) fail("index.html must start with an HTML5 doctype");
if (!/<html\b[^>]*\blang="en"/i.test(html)) fail("The html element must declare lang=\"en\"");
if (!/<meta\b[^>]*name="viewport"/i.test(html)) fail("Missing viewport meta");
if (!/<meta\b[^>]*http-equiv="Content-Security-Policy"/i.test(html)) fail("Missing Content Security Policy");
if (!/<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex[^"]*nofollow/i.test(html)) {
  fail("Missing noindex,nofollow robots safeguard");
}
if (!/<a\b[^>]*class="skip-link"[^>]*href="#main-content"/i.test(html)) fail("Missing skip link to #main-content");
if (!/<main\b[^>]*id="main-content"/i.test(html)) fail("Missing main landmark with id=main-content");
if (!/<nav\b[^>]*aria-label=/i.test(html)) fail("Missing labeled navigation landmark");
if (!/<header\b/i.test(html) || !/<footer\b/i.test(html) || !/<aside\b/i.test(html)) {
  fail("Expected header, aside, main, and footer landmarks");
}

const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const ids = new Set();
for (const id of idMatches) {
  if (ids.has(id)) fail(`Duplicate id: ${id}`);
  ids.add(id);
}

for (const section of requiredSections) {
  if (!ids.has(section)) fail(`Missing required section #${section}`);
}

const fragmentLinks = [...html.matchAll(/\bhref="#([^"]+)"/g)].map((match) => match[1]);
for (const fragment of fragmentLinks) {
  if (!ids.has(fragment)) fail(`Unresolved fragment link: #${fragment}`);
}

const buttons = [...html.matchAll(/<button\b([^>]*)>/gi)];
for (const [, attributes] of buttons) {
  if (!/\btype="button"/i.test(attributes)) fail(`Button missing type=\"button\": <button${attributes}>`);
}
if (/\son[a-z]+="/i.test(html)) fail("Inline event handlers are prohibited; keep behavior in app.js");

const detailsBlocks = [...html.matchAll(/<details\b[\s\S]*?<\/details>/gi)];
if (detailsBlocks.length < 15) fail(`Expected at least 15 expandable preparation cards; found ${detailsBlocks.length}`);
for (const [index, match] of detailsBlocks.entries()) {
  if (!/<summary\b/i.test(match[0])) fail(`Details element ${index + 1} has no summary`);
}

const tableBlocks = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)];
for (const [index, match] of tableBlocks.entries()) {
  if (!/<caption\b/i.test(match[0])) fail(`Table ${index + 1} has no caption`);
  if (!/<th\b[^>]*scope="/i.test(match[0])) fail(`Table ${index + 1} has no scoped header cell`);
}

const progressKeys = [...html.matchAll(/\bdata-progress="([^"]+)"/g)].map((match) => match[1]);
if (new Set(progressKeys).size !== progressKeys.length) fail("Readiness checklist data-progress keys must be unique");
if (progressKeys.length < 20) fail(`Expected at least 20 local readiness actions; found ${progressKeys.length}`);

const knownCategories = new Set(["call", "technical", "portfolio", "commercial", "interview", "evidence"]);
for (const match of html.matchAll(/\bdata-category="([^"]+)"/g)) {
  for (const category of match[1].split(/\s+/)) {
    if (!knownCategories.has(category)) fail(`Unknown filter category: ${category}`);
  }
}

const blankLinks = [...html.matchAll(/<a\b([^>]*\btarget="_blank"[^>]*)>/gi)];
for (const [, attributes] of blankLinks) {
  if (!/\brel="[^"]*\bnoopener\b[^"]*"/i.test(attributes)) fail("target=_blank link missing rel=noopener");
}

const svgBlocks = [...html.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)];
if (svgBlocks.length < 3) fail("Expected at least three original inline SVG diagrams");
for (const [index, match] of svgBlocks.entries()) {
  if (!/<title\b/i.test(match[0]) || !/<desc\b/i.test(match[0])) {
    fail(`Inline SVG ${index + 1} needs both title and description`);
  }
}

const citedSources = new Set([...html.matchAll(/class="cite"[^>]*href="#(src-[^"]+)"/g)].map((match) => match[1]));
if (citedSources.size < 20) fail(`Expected at least 20 distinct cited sources; found ${citedSources.size}`);
for (const source of citedSources) {
  if (!ids.has(source)) fail(`Citation points to missing source entry: #${source}`);
}

const sourceEntries = [
  ...html.matchAll(/(<li\b[^>]*id="(src-[^"]+)"[^>]*class="source-entry"[\s\S]*?<\/li>)/g)
];
if (sourceEntries.length < 20) fail(`Expected at least 20 source-register entries; found ${sourceEntries.length}`);
for (const [, entry, sourceId] of sourceEntries) {
  if (!/\bdata-reviewed="\d{4}-\d{2}-\d{2}"/.test(entry)) fail(`${sourceId} lacks a reviewed date`);
  if (!/class="source-url"[^>]*href="https:\/\//.test(entry)) fail(`${sourceId} lacks an HTTPS source URL`);
  if (!/class="source-title"/.test(entry)) fail(`${sourceId} lacks a source title`);
  if (!/class="source-meta"/.test(entry)) fail(`${sourceId} lacks publisher/date/classification metadata`);
  if (!/class="source-support"/.test(entry)) fail(`${sourceId} lacks an exact-support note`);
  if (!citedSources.has(sourceId)) warn(`${sourceId} is not cited in the preparation content`);
}

for (let item = 1; item <= 11; item += 1) {
  if (!new RegExp(`data-jd="${item}"`).test(html)) fail(`JD traceability is missing responsibility ${item}`);
}
for (const minimum of ["min-degree", "min-networking", "min-dcn-launch"]) {
  if (!html.includes(`data-jd="${minimum}"`)) fail(`JD traceability is missing ${minimum}`);
}
for (const preferred of ["pref-education", "pref-pm", "pref-design", "pref-commercial", "pref-ramp"]) {
  if (!html.includes(`data-jd="${preferred}"`)) fail(`JD traceability is missing ${preferred}`);
}

const invalidPlaceholders = [...html.matchAll(/\[(?!VERIFY\]|ADD YOUR FACT\])([A-Z][A-Z _-]{2,})\]/g)];
for (const match of invalidPlaceholders) fail(`Unapproved placeholder token: ${match[0]}`);
if (/\b(TODO|TBD|FIXME)\b/.test(html)) fail("Found TODO/TBD/FIXME text; use only intentional [VERIFY] or [ADD YOUR FACT] prompts");
if (!html.includes("[VERIFY]") || !html.includes("[ADD YOUR FACT]")) {
  fail("Both [VERIFY] and [ADD YOUR FACT] prompts must remain visible");
}

const externalRuntime = [
  ...html.matchAll(/<script\b[^>]*\bsrc="(https?:\/\/[^"]+)"/gi),
  ...html.matchAll(/<link\b[^>]*\bhref="(https?:\/\/[^"]+)"[^>]*rel="stylesheet"/gi)
];
if (externalRuntime.length) fail("External runtime dependency detected in index.html");
if (/@import\s+url\(\s*https?:/i.test(files["styles.css"])) fail("External CSS import detected");
if (/\b(fetch|XMLHttpRequest|WebSocket)\s*\(/.test(files["app.js"])) fail("app.js must not make runtime network requests");

if (!/Public-content warning/i.test(readme)) fail("README must explain that published content is publicly accessible");
if (!/https:\/\/frankellydeleon\.github\.io\/dc-networking-pm-interview-prep\//i.test(readme)) {
  fail("README must include the expected GitHub Pages URL");
}
if (!/local preview/i.test(readme)) fail("README must retain local-preview instructions");

async function walk(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...(await walk(absolute)));
    else results.push(path.relative(root, absolute));
  }
  return results;
}

const repositoryFiles = await walk(root);
for (const file of repositoryFiles) {
  if (/^CNAME$/i.test(file)) fail("Unexpected custom Pages domain; this site should use the documented github.io URL");
  if (/^\.github\/workflows\/.*pages.*\.ya?ml$/i.test(file)) {
    fail(`Unexpected Pages workflow; deployment should use the configured main-branch source: ${file}`);
  }
  if (/^\.github\/workflows\/.*\.ya?ml$/i.test(file)) {
    const workflow = await readFile(path.join(root, file), "utf8");
    if (/pages|deploy-pages|github-pages/i.test(workflow)) {
      fail(`Unexpected Pages workflow content; deployment should use the configured main-branch source: ${file}`);
    }
  }
}

const syntax = spawnSync(process.execPath, ["--check", path.join(root, "app.js")], { encoding: "utf8" });
if (syntax.status !== 0) fail(`JavaScript syntax check failed:\n${syntax.stderr.trim()}`);

const externalUrls = new Set([...html.matchAll(/\bhref="(https:\/\/[^"]+)"/g)].map((match) => match[1]));
for (const raw of externalUrls) {
  try {
    const url = new URL(raw);
    if (!url.hostname.includes(".")) fail(`Malformed external URL: ${raw}`);
  } catch {
    fail(`Invalid external URL: ${raw}`);
  }
}

if (process.argv.includes("--check-links")) {
  const urls = [...externalUrls];
  let cursor = 0;
  const failures = [];
  const check = async () => {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        let response = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          signal: controller.signal,
          headers: { "user-agent": "dcn-prep-link-check/1.0" }
        });
        if (response.status === 405) {
          response = await fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
            headers: { "user-agent": "dcn-prep-link-check/1.0", range: "bytes=0-1024" }
          });
        }
        if (!(response.ok || [401, 403, 429].includes(response.status))) {
          failures.push(`${response.status} ${url}`);
        }
      } catch (error) {
        failures.push(`${error instanceof Error ? error.name : "error"} ${url}`);
      } finally {
        clearTimeout(timeout);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, urls.length) }, check));
  failures.forEach((failure) => warn(`Link check: ${failure}`));
  console.log(`Checked ${urls.length} external links (${failures.length} warning${failures.length === 1 ? "" : "s"}).`);
}

warnings.forEach((message) => console.warn(`WARN: ${message}`));
if (errors.length) {
  errors.forEach((message) => console.error(`ERROR: ${message}`));
  console.error(`\nValidation failed with ${errors.length} error${errors.length === 1 ? "" : "s"}.`);
  process.exit(1);
}

console.log(
  `Validation passed: ${requiredSections.length} sections, ${idMatches.length} unique IDs, ` +
    `${citedSources.size} cited sources, ${buttons.length} typed buttons, ${svgBlocks.length} accessible diagrams.`
);
