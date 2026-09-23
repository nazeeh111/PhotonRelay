# Contributing to PhotonRelay

Small, focused fixes, reproducible bug reports, documentation improvements and translation reviews are welcome. For large features, open an issue to discuss scope before starting.

## Licensing and attribution

PhotonRelay is distributed under AGPL-3.0-or-later. Preserve the existing LICENSE, NOTICE and third-party notices. Submit only changes you have authority to contribute under the project license. PhotonRelay does not require the upstream project's CLA and does not offer or promise an upstream commercial license. Contributors retain their copyright; this policy does not request a copyright assignment.

Historical upstream CLA documents are retained only as provenance in `docs/upstream/`; they are not PhotonRelay contribution requirements.

## Before submitting

Use Node.js 24 or newer, then run:

```sh
npm ci
npm test
npm run build:all
npm run verify:publication
```

Explain the problem, your change, and the checks you ran. For protocol changes, include compatibility and regression tests. The channel lab must remain explicit about its software simulation scope. Do not present synthetic results as physical throughput measurements.

For camera problems, include browser, operating system, device models and reproduction steps. Do not attach private payloads or identifying images unnecessarily. For translations, follow `docs/technical/localization.md`; keep parameters and markup intact and only mark a language reviewed after a fluent review.
