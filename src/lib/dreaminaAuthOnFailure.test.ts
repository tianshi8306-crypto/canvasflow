import { describe, expect, it, vi, beforeEach } from "vitest";
import { checkDreaminaAuthState } from "./dreaminaAuth";
import { refreshDreaminaAuthOnGenerationFailure } from "./dreaminaAuthOnFailure";

vi.mock("./dreaminaAuth", () => ({
  checkDreaminaAuthState: vi.fn(),
}));

vi.mock("./dreaminaAuthEvents", () => ({
  notifyDreaminaAuthUpdated: vi.fn(),
}));

describe("refreshDreaminaAuthOnGenerationFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips non-dreamina models", () => {
    refreshDreaminaAuthOnGenerationFailure("doubao_seedance_2_0");
    expect(checkDreaminaAuthState).not.toHaveBeenCalled();
  });

  it("refreshes on dreamina model failure", async () => {
    vi.mocked(checkDreaminaAuthState).mockResolvedValue({
      isLoggedIn: false,
      statusText: "未登录",
      message: "",
      creditText: "",
      installed: true,
      runtime: null,
    });
    refreshDreaminaAuthOnGenerationFailure("dreamina/4.5");
    await vi.waitFor(() => expect(checkDreaminaAuthState).toHaveBeenCalledWith(true, { preferCache: false }));
  });
});
