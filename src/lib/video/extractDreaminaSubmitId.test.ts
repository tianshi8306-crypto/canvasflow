import { describe, expect, it } from "vitest";
import { extractDreaminaSubmitId, resolveDreaminaSubmitId } from "./extractDreaminaSubmitId";

describe("extractDreaminaSubmitId", () => {
  it("parses JSON submit_id", () => {
    expect(
      extractDreaminaSubmitId(
        '{"submit_id":"f64d4c23-d334-415a-bb2f-0383ee8544aa","gen_status":"fail"}',
      ),
    ).toBe("f64d4c23-d334-415a-bb2f-0383ee8544aa");
  });

  it("accepts bare uuid job id", () => {
    expect(extractDreaminaSubmitId("f64d4c23-d334-415a-bb2f-0383ee8544aa")).toBe(
      "f64d4c23-d334-415a-bb2f-0383ee8544aa",
    );
  });
});

describe("resolveDreaminaSubmitId", () => {
  it("prefers job id then error text", () => {
    expect(
      resolveDreaminaSubmitId({
        jobId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        error: '{"submit_id":"f64d4c23-d334-415a-bb2f-0383ee8544aa"}',
      }),
    ).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });
});
