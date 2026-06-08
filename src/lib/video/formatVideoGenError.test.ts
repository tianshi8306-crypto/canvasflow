import { describe, expect, it } from "vitest";
import { parseVideoGenError } from "./formatVideoGenError";

describe("parseVideoGenError", () => {
  it("maps dreamina CLI 1310 to account video quota hint", () => {
    const raw =
      'api error: ret=1310, message=ExceedConcurrencyLimit {"submit_id":"abc","gen_status":"fail"}';
    const p = parseVideoGenError(raw);
    expect(p.summary).toContain("即梦");
    expect(p.summary).toContain("积分");
    expect(p.summary).toContain("取回即梦成片");
    expect(p.summary).not.toBe("当前生成并发已满，请稍后重试");
  });

  it("maps ExceedConcurrencyLimit to human message", () => {
    const raw =
      "video_gen_start 调用失败 (bridge 模式, 不允许回退 mock) : api error: ret=1310, message=ExceedConcurrencyLimit, logid=abc123";
    const p = parseVideoGenError(raw);
    expect(p.summary).toContain("并发已满");
    expect(p.summary).not.toMatch(/logid|bridge|mock/i);
    expect(p.technicalDetail).toContain("logid");
  });

  it("maps sensitive reference image to human message", () => {
    const raw =
      '视频生成失败(400): {"error":{"code":"InputImageSensitiveContentDetected.PrivacyInformation","message":"The request failed because the input image may contain real person."}}';
    const p = parseVideoGenError(raw);
    expect(p.summary).toContain("参考图");
    expect(p.summary).toContain("真人");
    expect(p.technicalDetail).toContain("PrivacyInformation");
  });

  it("maps post-TNS check failure to human message", () => {
    const raw = "视频生成失败：generation failed: post-TNS check did not pass";
    const p = parseVideoGenError(raw);
    expect(p.summary).toContain("云端安全审核");
    expect(p.summary).not.toMatch(/generation failed|TNS check/i);
    expect(p.technicalDetail).toContain("post-TNS");
  });

  it("keeps short user-facing messages", () => {
    const p = parseVideoGenError("网络超时，请重试");
    expect(p.summary).toBe("网络超时，请重试");
    expect(p.technicalDetail).toBeUndefined();
  });
});
