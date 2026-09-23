import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { rootPwaHead } from "../build/root-pwa-head";

class FakeElement {
  textContent = "";
  id = "";
  type = "";
  disabled = false;
  style: Record<string, string> = {};
  children: FakeElement[] = [];
  attrs: Record<string, string> = {};
  listeners = new Map<string, () => void>();
  append(...children: FakeElement[]) { this.children.push(...children); }
  setAttribute(key: string, value: string) { this.attrs[key] = value; }
  addEventListener(event: string, listener: () => void) { this.listeners.set(event, listener); }
}

function emittedRegistration() {
  const plugin = rootPwaHead();
  const hook = plugin.generateBundle;
  assert.equal(typeof hook, "function");
  const bundle = { "send/index.html": { type: "asset", fileName: "send/index.html", source: '<html><head><link rel="manifest" href="./manifest.webmanifest"></head><body></body></html>' } };
  (hook as Function).call({}, {}, bundle);
  const script = /<script>([\s\S]*?)<\/script>/.exec(bundle["send/index.html"].source)?.[1];
  assert.ok(script);
  return script;
}

async function fixture(options: { waiting?: boolean; installing?: boolean; fail?: boolean; controlled?: boolean } = {}) {
  const body = new FakeElement();
  const callbacks = new Map<string, () => void>();
  const workerCallbacks = new Map<string, () => void>();
  const registrationCallbacks = new Map<string, () => void>();
  const messages: unknown[] = [];
  const worker = { state: "installing", postMessage: (value: unknown) => messages.push(value), addEventListener: (event: string, listener: () => void) => workerCallbacks.set(event, listener) };
  let reloads = 0;
  let checks = 0;
  const registration = { waiting: options.waiting ? worker : null, installing: options.installing ? worker : null,
    update: async () => { checks++; return registration; },
    addEventListener: (event: string, listener: () => void) => registrationCallbacks.set(event, listener) };
  const navigator = { onLine: true, serviceWorker: {
    controller: options.controlled === false ? null : {},
    addEventListener: (event: string, listener: () => void) => callbacks.set(event, listener),
    register: async () => { if (options.fail) throw new Error("offline"); return registration; },
  }};
  vm.runInNewContext(emittedRegistration(), {
    navigator, window: { addEventListener: (event: string, listener: () => void) => callbacks.set(event, listener) },
    document: { body, createElement: () => new FakeElement() }, location: { reload: () => { reloads++; } }, console,
  });
  callbacks.get("load")?.();
  await new Promise(resolve => setImmediate(resolve));
  return { body, callbacks, workerCallbacks, registrationCallbacks, messages, worker, registration, reloads: () => reloads, checks: () => checks };
}

function text(node: FakeElement): string { return node.textContent + node.children.map(text).join(" "); }

test("waiting update never forces activation or reload and explains all-tab restart", async () => {
  const f = await fixture({ waiting: true });
  assert.deepEqual(f.messages, []);
  f.callbacks.get("controllerchange")?.();
  assert.equal(f.reloads(), 0);
  assert.match(text(f.body), /close all PhotonRelay tabs/i);
  assert.match(text(f.body), /save/i);
});

test("registration already installing is observed without an updatefound race", async () => {
  const f = await fixture({ installing: true });
  f.worker.state = "installed";
  f.registration.waiting = f.worker;
  f.workerCallbacks.get("statechange")?.();
  assert.match(text(f.body), /update is ready/i);
  assert.deepEqual(f.messages, []);
});

test("later updatefound shows a notice without interrupting the current page", async () => {
  const f = await fixture();
  f.registration.installing = f.worker;
  f.registrationCallbacks.get("updatefound")?.();
  f.worker.state = "installed";
  f.registration.waiting = f.worker;
  f.workerCallbacks.get("statechange")?.();
  assert.match(text(f.body), /update is ready/i);
  assert.equal(f.reloads(), 0);
  assert.deepEqual(f.messages, []);
});

test("first installation is not advertised as a pending update", async () => {
  const f = await fixture({ installing: true, controlled: false });
  f.worker.state = "installed";
  f.workerCallbacks.get("statechange")?.();
  assert.equal(f.body.children.length, 0);
});

test("registration failure is handled without stopping the page", async () => {
  const f = await fixture({ fail: true });
  assert.equal(f.reloads(), 0);
  assert.equal(f.body.children.length, 0);
});

test("new worker ignores legacy SKIP_WAITING messages but leaves other messages alone", () => {
  const listeners: ((event: { data: unknown; stopImmediatePropagation: () => void }) => void)[] = [];
  vm.runInNewContext(readFileSync(new URL("../public/pwa-update-guard.js", import.meta.url), "utf8"), {
    self: { addEventListener: (_type: string, callback: (event: { data: unknown; stopImmediatePropagation: () => void }) => void) => listeners.push(callback) },
  });
  let skipped = 0;
  // Workbox adds this generated listener after importScripts has run.
  listeners.push(event => { if ((event.data as {type?: string})?.type === "SKIP_WAITING") skipped++; });
  const dispatch = (data: unknown) => {
    let stopped = false;
    for (const callback of listeners) { callback({ data, stopImmediatePropagation: () => { stopped = true; } }); if (stopped) break; }
    return stopped;
  };
  assert.equal(dispatch({type:"SKIP_WAITING"}), true);
  assert.equal(skipped, 0);
  assert.equal(dispatch({type:"OTHER"}), false);
  assert.equal(dispatch(null), false);
});

test("check again only requests an update check and never activates a worker", async () => {
  const f = await fixture({ waiting: true });
  const notice = f.body.children[0]!;
  const check = notice.children.find(child => child.type === "button")!;
  assert.ok(check);
  check.listeners.get("click")?.();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.checks(), 1);
  assert.equal(check.disabled, false);
  assert.deepEqual(f.messages, []);
  assert.equal(f.reloads(), 0);
});

test("update checks can fail offline without discarding the ready-update guidance", async () => {
  const f = await fixture({ waiting: true });
  f.registration.update = async () => { throw new Error("offline"); };
  const check = f.body.children[0]!.children.find(child => child.type === "button")!;
  check.listeners.get("click")?.();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(text(f.body), /could not check/i);
  assert.match(text(f.body), /close all PhotonRelay tabs/i);
  assert.equal(check.disabled, false);
  assert.equal(f.reloads(), 0);
});
