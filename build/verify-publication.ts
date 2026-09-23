import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const hashes: Record<string,string> = JSON.parse(read("docs/upstream-benchmark-sha256.json"));
for (const [path, expected] of Object.entries(hashes)) {
  assert.equal(createHash("sha256").update(readFileSync(resolve(root,path))).digest("hex"),expected,`Historical upstream artifact changed: ${path}`);
}
assert.match(read("README.md"), /upstream measurements, not PhotonRelay measurements/);
const site = process.env.VITE_SITE_URL ?? "https://nazeeh111.github.io/PhotonRelay/";
assert.ok(read("dist/robots.txt").includes(`Sitemap: ${new URL("sitemap.xml",site).href}`));
assert.ok(read("dist/sitemap.xml").includes(site));
assert.ok(!read("dist/robots.txt").includes("decimen.app"));
const chunks = readdirSync(resolve(root,"dist/assets")).filter(n => /^receive-.*\.js$/.test(n));
assert.equal(chunks.length,1);assert.ok(statSync(resolve(root,"dist/assets",chunks[0]!)).size < 24000);
for (const page of ["index", "send/index", "receive/index"]) {
  const html=read(`dist/${page}.html`);
  const refs=[...html.matchAll(/(?:href="([^"]*manifest\.webmanifest)"|register\(["']([^"']*sw\.js)["'])/g)];
  assert.ok(refs.length >= 2,`PWA references missing: ${page}`);
  for(const match of refs)assert.ok(existsSync(resolve(root,"dist",dirname(page),match[1]??match[2]!)),`Missing PWA target: ${match[0]}`);
  assert.match(html,/PhotonRelay/);
}
assert.equal(JSON.parse(read("dist/manifest.webmanifest")).name,"PhotonRelay");
console.log(`Publication checks passed: ${Object.keys(hashes).length} upstream artifacts unchanged; metadata, PWA targets and receive chunk verified.`);
