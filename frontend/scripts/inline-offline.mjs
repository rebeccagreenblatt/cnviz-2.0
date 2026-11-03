// Turns the `vite build --mode offline` output into ONE self-contained HTML file:
//   dist-offline/cnviz-<version>.html  and  dist-offline/cnviz-<version>.html.sha256
// JS and CSS are inlined; the Content-Security-Policy allows only that exact script (by SHA-256 hash)
// and blocks every network connection. The page works opened straight from disk (file://) or from any web server.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url)); // handles spaces and other special characters in paths
const out = join(root, "dist-offline");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const fail = (msg) => { console.error(`inline-offline: ${msg}`); process.exit(1); };
const sha256b64 = (s) => createHash("sha256").update(s, "utf8").digest("base64");

let html = readFileSync(join(out, "index.html"), "utf8");
const read = (ref) => readFileSync(join(out, ref.replace(/^\.?\//, "")), "utf8");

// One module script and at most one stylesheet are expected (inlineDynamicImports, cssCodeSplit off)
const scripts = [...html.matchAll(/<script type="module" crossorigin src="([^"]+)"><\/script>/g)];
if (scripts.length !== 1) fail(`expected 1 module script, found ${scripts.length}`);
let js = read(scripts[0][1]);
// The HTML parser ends a script at "</script"; "<!--" can also confuse it. Escape the first, refuse the second.
js = js.replace(/<\/script/gi, "<\\/script");
if (js.includes("<!--")) fail("bundle contains '<!--'; inlining would be unsafe");
html = html.replace(scripts[0][0], () => `<script type="module">${js}</script>`);

const styles = [...html.matchAll(/<link rel="stylesheet" crossorigin href="([^"]+)">/g)];
for (const [tag, href] of styles) {
  const css = read(href).replace(/<\/style/gi, "<\\/style");
  html = html.replace(tag, () => `<style>${css}</style>`);
}

// Favicon as a data: URI
const svg = readFileSync(join(root, "public", "favicon.svg"));
html = html.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${svg.toString("base64")}" />`);

// Strict CSP: only this exact script may run; no connections, no external anything
const csp = [
  "default-src 'none'",
  `script-src 'sha256-${sha256b64(js)}' 'unsafe-eval'`, // unsafe-eval: Plotly compiles some functions at runtime; no other code can run
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "worker-src blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");
if (!/<meta http-equiv="Content-Security-Policy"[^>]*>/.test(html)) fail("CSP meta tag not found in index.html");
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, `<meta http-equiv="Content-Security-Policy" content="${csp}">`);
html = html.replace(/<title>[^<]*<\/title>/, `<title>CNViz ${version} (offline)</title>`);

if (/<(script|link)[^>]*\s(src|href)="(?!data:)[^"]+"/.test(html)) fail("a reference to an external file remains");

const name = `cnviz-${version}.html`;
for (const f of readdirSync(out)) rmSync(join(out, f), { recursive: true });
writeFileSync(join(out, name), html);
const digest = createHash("sha256").update(html, "utf8").digest("hex");
writeFileSync(join(out, `${name}.sha256`), `${digest}  ${name}\n`);
console.log(`${name}  ${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB\nsha256 ${digest}`);
