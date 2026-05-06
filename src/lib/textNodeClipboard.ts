export async function readClipboardText(): Promise<string> {
  return navigator.clipboard.readText();
}

export async function writeClipboardText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export function downloadTextAsFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
