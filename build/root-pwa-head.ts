import type { Plugin } from "vite";

/**
 * Own the manifest link and the service-worker registration for every page.
 *
 * Two problems, one owner:
 *
 * 1. PATHS. vite-plugin-pwa resolves what it injects against `base`, which is
 *    "./" — so it resolves against the PAGE, while manifest.webmanifest and
 *    sw.js only exist at the site root. From /send/ and /receive/ they 404,
 *    which made the receiver — the page the README tells you to add to your
 *    home screen — the one page that never registered a worker at all.
 *    base "./" is what lets one build work under any subpath, so it stays and
 *    the references get a "../" per directory of depth instead.
 *
 * 2. UPDATES. A transfer's payload, decoder progress and received output live
 *    in memory. Activating a new worker or reloading a page automatically can
 *    interrupt any open tab, not just the one discovering the update. Leave
 *    the worker waiting and explain the browser's close-all-tabs lifecycle.
 *    public/pwa-update-guard.js also blocks old pages' SKIP_WAITING messages.
 *
 * Doing both here means `injectRegister: false`, so no generated string is
 * left to depend on.
 */
export function rootPwaHead(): Plugin {
  const registration = (prefix: string) =>
    `
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("${prefix}sw.js", { scope: "${prefix}" }).then((reg) => {
      let notice;
      let checkStatus;
      const showUpdate = () => {
        if (!reg.waiting || notice) return;
        notice = document.createElement("aside");
        notice.id = "pwa-update-notice";
        notice.setAttribute("role", "status");
        notice.setAttribute("aria-live", "polite");
        Object.assign(notice.style, {
          margin: "1rem auto", padding: "1rem", maxWidth: "60rem",
          border: "1px solid #64748b", borderRadius: "0.75rem",
          background: "#172033", color: "#f1f5f9", font: "14px/1.5 system-ui"
        });
        const title = document.createElement("strong");
        title.textContent = "A PhotonRelay update is ready.";
        const guidance = document.createElement("p");
        guidance.textContent = "Finish transfers and save received files. Close all PhotonRelay tabs and installed app windows, then reopen PhotonRelay to use the new version. Refresh alone may keep the current version. Your current transfer will not be restarted automatically.";
        const check = document.createElement("button");
        check.type = "button";
        check.textContent = "Check again";
        Object.assign(check.style, {
          padding: "0.5rem 0.8rem", border: "1px solid #94a3b8",
          borderRadius: "0.4rem", background: "#e2e8f0", color: "#0f172a",
          cursor: "pointer", font: "inherit"
        });
        checkStatus = document.createElement("p");
        check.addEventListener("click", async () => {
          check.disabled = true;
          checkStatus.textContent = "Checking for updates…";
          try {
            await reg.update();
            checkStatus.textContent = reg.waiting
              ? "The update is ready. Close all PhotonRelay tabs and app windows, then reopen."
              : "Check complete. An update may still be downloading; keep this page open to finish.";
          } catch {
            checkStatus.textContent = "Could not check for updates. Reconnect and try again when convenient. Your current session is unchanged.";
          } finally {
            check.disabled = false;
          }
        });
        notice.append(title, guidance, check, checkStatus);
        // In document flow, never over the QR canvas or camera preview.
        document.body.append(notice);
      };
      const watch = (worker) => {
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed") showUpdate();
        });
      };
      reg.addEventListener("updatefound", () => watch(reg.installing));
      // An install may already be underway before register() resolves.
      watch(reg.installing);
      showUpdate();
      // Check once on page load; no polling, activation or reload side effects.
      if (!reg.waiting) reg.update().catch(() => {});
    }).catch(() => {
      // Registration can fail offline or in restricted browser modes. Keep
      // the loaded transfer page usable; never turn this into a reload loop.
    });
  });
}`.trim();

  // Matched loosely: the exact attribute order and self-closing style are
  // vite-plugin-pwa's business, only the href is ours.
  // vite-plugin-pwa injects the manifest link during generateBundle, after
  // transformIndexHtml has already run — so the rewrite has to happen there
  // too, which is also where the registration script gets appended.
  const MANIFEST_LINK = /<link[^>]*rel="manifest"[^>]*>/;
  return {
    name: "root-pwa-head",
    enforce: "post",
    generateBundle(_options, bundle) {
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== "asset" || !fileName.endsWith(".html")) continue;
        const depth = fileName.split("/").length - 1;
        const prefix = depth === 0 ? "./" : "../".repeat(depth);
        const html =
          typeof asset.source === "string"
            ? asset.source
            : new TextDecoder().decode(asset.source);

        if (!MANIFEST_LINK.test(html)) {
          throw new Error(`${fileName}: no manifest link to re-point — root-pwa-head is stale`);
        }
        if (!html.includes("</body>")) {
          throw new Error(`${fileName}: no </body> to append the registration to`);
        }

        const next = html
          .replace(MANIFEST_LINK, `<link rel="manifest" href="${prefix}manifest.webmanifest">`)
          .replace("</body>", `<script>${registration(prefix)}</script></body>`);

        // Resolve what we just wrote the way a browser would, from a page served
        // under a project subpath. Anything not landing on the site root is the
        // bug this plugin exists to prevent.
        const page = new URL(fileName, "https://example.test/repo/");
        const root = "https://example.test/repo/";
        const manifest = /<link rel="manifest" href="([^"]+)"/.exec(next)?.[1];
        const sw = /register\("([^"]+)", \{ scope: "([^"]+)" \}\)/.exec(next);
        const checks: [string, string | undefined, string][] = [
          ["manifest", manifest, `${root}manifest.webmanifest`],
          ["service worker", sw?.[1], `${root}sw.js`],
          ["service worker scope", sw?.[2], root],
        ];
        for (const [what, value, expected] of checks) {
          if (value === undefined) throw new Error(`${fileName}: no ${what} reference found`);
          const actual = new URL(value, page).href;
          if (actual !== expected) {
            throw new Error(`${fileName}: ${what} resolves to ${actual}, expected ${expected}`);
          }
        }
        asset.source = next;
      }
    },
  };
}
