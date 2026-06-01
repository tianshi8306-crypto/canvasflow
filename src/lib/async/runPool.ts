/**
 * 有限并发执行异步任务队列（保持结果顺序与输入一致）。
 */
export async function runPool<T, R>(
  items: readonly T[],
  maxConcurrent: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(maxConcurrent, items.length));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: limit }, async () => {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await worker(items[i]!, i);
    }
  });

  await Promise.all(runners);
  return results;
}
