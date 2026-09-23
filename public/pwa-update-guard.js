// Old PhotonRelay pages automatically send SKIP_WAITING when they discover an
// update. Ignore that legacy request before Workbox's listener can activate
// this worker and disrupt transfers in other tabs. Natural activation still
// occurs when no page is controlled by the previous worker.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    event.stopImmediatePropagation();
  }
});
