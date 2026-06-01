/** 合并并发保存：进行中时只记「还需再存一次」，避免排队多次写盘 */
let saveInFlight = false;
let saveAgain = false;

export async function runCoalescedProjectSave(run: () => Promise<void>): Promise<void> {
  if (saveInFlight) {
    saveAgain = true;
    return;
  }
  saveInFlight = true;
  try {
    do {
      saveAgain = false;
      await run();
      if (saveAgain) {
        await new Promise<void>((r) => window.setTimeout(r, 48));
      }
    } while (saveAgain);
  } finally {
    saveInFlight = false;
  }
}

export function isProjectSaveInFlight(): boolean {
  return saveInFlight;
}
