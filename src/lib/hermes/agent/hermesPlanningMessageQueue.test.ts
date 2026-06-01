import { describe, expect, it, beforeEach } from "vitest";
import {
  clearPlanningMessageQueue,
  enqueuePlanningProductionMessage,
  formatPlanningQueueAck,
  hermesPlanningQueueStatusHint,
  loadPlanningMessageQueue,
  dequeuePlanningProductionMessage,
  HERMES_PLANNING_QUEUE_MAX,
  removePlanningQueueItems,
} from "@/lib/hermes/agent/hermesPlanningMessageQueue";

const PROJECT = "/proj/planning-queue-test";

describe("hermesPlanningMessageQueue", () => {
  beforeEach(() => {
    clearPlanningMessageQueue(PROJECT);
  });

  it("enqueue and dequeue fifo", () => {
    expect(enqueuePlanningProductionMessage(PROJECT, "出分镜图").ok).toBe(true);
    expect(enqueuePlanningProductionMessage(PROJECT, "导出成片").ok).toBe(true);
    expect(loadPlanningMessageQueue(PROJECT)).toHaveLength(2);
    expect(dequeuePlanningProductionMessage(PROJECT)?.text).toBe("出分镜图");
    expect(dequeuePlanningProductionMessage(PROJECT)?.text).toBe("导出成片");
    expect(loadPlanningMessageQueue(PROJECT)).toHaveLength(0);
  });

  it("removePlanningQueueItems drops matching entries", () => {
    enqueuePlanningProductionMessage(PROJECT, "帮第 2 镜出图");
    enqueuePlanningProductionMessage(PROJECT, "帮第 3 镜出图");
    expect(
      removePlanningQueueItems(PROJECT, (item) => item.text.includes("第 2 镜")),
    ).toBe(1);
    expect(loadPlanningMessageQueue(PROJECT)).toHaveLength(1);
  });

  it("dedupes identical normalized text", () => {
    const first = enqueuePlanningProductionMessage(PROJECT, "出图  ");
    const second = enqueuePlanningProductionMessage(PROJECT, "出图");
    expect(first.ok && first.duplicate === false).toBe(true);
    expect(second.ok && second.duplicate === true).toBe(true);
    expect(loadPlanningMessageQueue(PROJECT)).toHaveLength(1);
  });

  it("respects max queue size", () => {
    for (let i = 0; i < HERMES_PLANNING_QUEUE_MAX; i++) {
      expect(enqueuePlanningProductionMessage(PROJECT, `任务 ${i}`).ok).toBe(true);
    }
    const overflow = enqueuePlanningProductionMessage(PROJECT, "溢出");
    expect(overflow.ok).toBe(false);
  });

  it("status hint and ack copy", () => {
    const queue = [{ id: "1", text: "帮我把第 3 镜改成夜景", createdAt: 1 }];
    expect(hermesPlanningQueueStatusHint(queue)).toContain("规划完成后");
    expect(formatPlanningQueueAck(queue[0]!.text, 1)).toContain("第 1 位");
  });
});
