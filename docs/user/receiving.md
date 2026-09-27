# Receiving

Open PhotonRelay's **Receive** page, tap **Start camera**, and point it at the sender's moving code. The receiver can join a transfer already in progress and recognizes whether it contains a file or text. You can also point it at an [exported animation](sending.md#export-animation).

A stray code from another transfer will not clear your progress. To switch to a different sender, move the old code out of view. After 1.5 seconds without a frame from the active transfer, the receiver switches when it reads two different frames from the new transfer.

Keep the whole code in view and steady the phone to help the camera focus. Continuous autofocus is enabled when the camera supports it.

The progress bar estimates recovery from useful frames and recovered blocks. Repeated frames that add no data do not increase the estimate. The receiver verifies the completed file before offering it to save.

## When it lands

- The file is verified against its SHA-256 before anything is offered.
- Images, video, and audio preview inline — video plays in the page (never autoplays), other files just get the **Save** link. Turn off **Show received files automatically** and the preview waits behind a **Show** button instead; see [Privacy](privacy.md).
- **Receive another file** reloads into a fresh receiver.
- **Clear PhotonRelay cache** scrubs the received bytes from browser storage, and appears only when something is actually cached — see [Privacy](privacy.md).
- Text snippets appear with a **Copy** button and exist only until the tab closes.

**Live diagnostics** (capture/decode fps, goodput, frames, K) is collapsible during the transfer and becomes the **Transfer summary** when it ends.

## Receive settings

Camera settings apply live while the camera runs; a device that refuses a live reconfigure (iOS, sometimes) keeps the current stream and says so. Frame rates the camera reports it cannot reach are grayed out.

| setting | default | notes |
|---|---|---|
| camera | auto | the device list fills in once the camera starts (browsers hide camera names until permission is granted); pick a specific one when auto grabs the wrong lens — front, or a telephoto — and the stream switches over live |
| capture width | 1280 | 1920 costs decode time; 960 helps weak CPUs |
| capture fps | 60 | iOS delivers 30 unless the exact rate is demanded — the app handles this |
| decode workers | device max | one WASM decoder per worker; busy workers drop frames, which the fountain absorbs |
| show received files automatically | on | the only setting that persists between sessions, and the only one read when a transfer *lands* rather than when the camera starts |
