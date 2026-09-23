# Install & offline

Three shapes, all built from the same source. Built artifacts for all three are attached to every [release](../../../../releases).

| | what it is | needs a server? | offline |
|---|---|---|---|
| **Hosted site** | three pages plus a service worker — live at [PhotonRelay](https://nazeeh111.github.io/PhotonRelay/) | yes, any static host | after the first visit |
| **`PhotonRelay-sender.html`** | one file, about 250 KB | no | always |
| **`PhotonRelay-receiver.html`** | one file, about 1 MB | see the caveat | always |

## Hosted site: install and offline

The site precaches everything, decoder wasm included — load it once and it works with the network off. Any page does it; landing straight on `/receive/` from a shared link caches the whole app.

Install it for the full-screen app experience:

- **Android** — Chrome offers *Install app* from the menu (real manifest, proper icons).
- **iOS** — Share → **Add to Home Screen**.

This is the shape to use on a phone: it keeps a real `https://` origin, which is what the camera wants.

## Standalone files

`npm run build:standalone` produces two pages with nothing external in them — no script src, no stylesheet, no fetch. The receiver carries the 940 KB decoder wasm as a `data:` URI, which accounts for most of its size. Mail one to someone, drop it on a USB stick.

**The receiver's one caveat:** opened from `file://`, the page gets an opaque origin. Desktop Chrome and Firefox will generally prompt for the camera and work; **iOS Safari and Android Chrome will not give a local file a camera.** Since the receiver is usually the phone, serve the file over trusted HTTPS, or use the hosted site's offline mode instead. Remote plain HTTP does not allow phone camera access. The sender has no such problem; it works from `file://` everywhere.

## Demo mode

```bash
npm run demo    # sender locked to the two bundled images
```

No file picker, no text box — for a sending machine sitting unattended in front of people. This is the dev server with `VITE_DEMO=1`, not a hardened kiosk: anyone with the keyboard has devtools.

## Camera access and local development

A phone camera needs a secure browser origin. Use the hosted HTTPS site for the simplest flow. For a local development server, configure a certificate trusted by the testing device; the bundled development certificate is self-signed and may be rejected. Plain HTTP on a remote LAN address does not provide a secure camera context. Desktop localhost is a special development exception.

## Updates

The app never reloads an active transfer automatically. When an update is ready, finish your transfer, save received files, close all PhotonRelay browser tabs and installed app windows, and reopen. A simple refresh may retain the previous cached version. When upgrading from an older version, close and reopen after finishing even if the older page has no update notice.
