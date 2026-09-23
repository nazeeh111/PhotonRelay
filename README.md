# PhotonRelay

**Offline optical file transfer, with a reproducible channel laboratory.**

Send files or text as animated QR frames from a screen to a camera. The complete sender and receiver remain available: fountain recovery, compression, SHA-256 verification, animation export, offline installation, standalone pages, and multilingual controls.

## Transfer without installing an app

1. Open [Send](https://nazeeh111.github.io/PhotonRelay/send/) on the sending device.
2. Scan the **setup QR** with the other device's ordinary phone camera. It opens PhotonRelay Receive in the browser. Tap **Start camera** there.
3. Select a file or text on the sender. Point the receiver at the **moving file code** until verification finishes, then save the result.

The setup QR is a regular web link. The moving QR carries binary file fragments and must be read inside PhotonRelay. Both pages need to load once while online before offline use. No app installation is required; receiving requires browser camera permission. Default streaming uses 24 fps and moderate density, with short messages encoded into smaller symbols. If reception struggles, use 10 fps and 500 bytes per frame in Transfer settings.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm test
npm run dev
npm run build:all
```

Open the HTTPS address printed by Vite. Use **Send** and **Receive** for optical transfer, or run the **engineering lab** on the home page without granting camera access. The production site is built into `dist/`; standalone sender and receiver files are in `dist-standalone/`. Their legacy filenames remain for compatibility.

## Engineering contribution

PhotonRelay adds a seeded channel diagnostic directly to the transfer application. It runs the production fountain encoder and decoder over a deterministic 64 KiB payload, models dropped and duplicated frames, shuffles delivery within 16-frame windows, and checks every recovered byte plus SHA-256. JSON reports include all model parameters and counts. Trials stop after at most 1,536 emitted frames, including at 100% loss. A failed recovery is reported as incomplete rather than a successful zero-byte transfer.

This is a **software channel simulation**, not measured camera throughput, an encryption scheme, or a guarantee of physical reception. It does not model optical blur, QR recognition, lighting, or display refresh timing. Files displayed on screen can be read by nearby cameras. The lab never activates a camera or contacts a server.

## Verification and operation

`npm test` includes the original protocol and application regression suite plus seeded lab reproducibility, recovery, duplicate handling, bounds, and total-loss tests. Full hardware interoperability still requires testing two real devices. Consult [sending](docs/user/sending.md), [receiving](docs/user/receiving.md), [privacy](docs/user/privacy.md), and [architecture](docs/technical/architecture.md).

## Provenance and licensing

PhotonRelay is an adaptation of [Decimen Optical Transfer](https://github.com/bashalarmistalt/decimen-optical-transfer), with new branding and the integrated channel lab by nazeeh111. The original transfer implementation and protocol are retained. [LICENSE](LICENSE), [NOTICE](NOTICE), and vendor notices apply; this project is **AGPL-3.0-or-later**, not MIT. Historical optical benchmark receipts in `benchmarks/` and the [archived upstream README](docs/UPSTREAM-README.md) are upstream measurements, not PhotonRelay measurements.

**Publication note:** PhotonRelay was prepared locally using Git before publication. A publication date records when this version was uploaded, not a claim of earlier development dates or authorship of upstream work.
