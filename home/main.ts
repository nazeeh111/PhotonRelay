// Home page script: init the locale layer, then wire the share dialog.
import { initI18n } from "../shared/i18n";
import { wireShareDialog } from "../shared/share-dialog";

await initI18n();

document.getElementById("share-open")!.addEventListener("click", wireShareDialog());

// An integrated diagnostic uses the production fountain implementation.
import { runChannelTrial } from "../shared/channel-lab";
const run = document.getElementById("lab-run") as HTMLButtonElement;
const exportButton = document.getElementById("lab-export") as HTMLButtonElement;
const resultView = document.getElementById("lab-result")!;
let report: string | null = null;
run.addEventListener("click", async () => {
  run.disabled = true; exportButton.disabled = true; report = null;
  resultView.textContent = "Simulating bounded channel…";
  try {
    const value = (id: string) => {
      const input = document.getElementById(id) as HTMLInputElement;
      if (!input.value.trim() || !input.checkValidity()) throw new Error("Enter valid seed and percentage values.");
      return Number(input.value);
    };
    const result = await runChannelTrial({ seed: value("lab-seed"), lossPercent: value("lab-loss"), duplicatePercent: value("lab-duplicate") });
    report = JSON.stringify(result, null, 2); resultView.textContent = report; exportButton.disabled = false;
  } catch (error) { resultView.textContent = error instanceof Error ? error.message : String(error); }
  finally { run.disabled = false; }
});
exportButton.addEventListener("click", () => {
  if (!report) return;
  const url = URL.createObjectURL(new Blob([report], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = "photonrelay-channel-trial.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
