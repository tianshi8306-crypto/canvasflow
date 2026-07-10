/** 从分镜块 / 带标签文本提取「光影氛围」 */
export function extractLightingMoodFromLabeledText(text: string): string {
  const lines = text.split("\n");
  const labels = ["光影氛围：", "光影氛围:", "光影：", "光影:", "光线：", "光线:"];
  for (const line of lines) {
    const t = line.trim();
    for (const label of labels) {
      if (t.startsWith(label)) {
        return t.slice(label.length).trim();
      }
    }
  }
  return "";
}

export function extractLightingMoodFromStoryboardBlock(block: string): string {
  return extractLightingMoodFromLabeledText(block);
}
