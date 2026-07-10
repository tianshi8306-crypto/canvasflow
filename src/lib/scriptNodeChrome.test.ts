import { describe, expect, it } from "vitest";

import {

  SCRIPT_NODE_SHELL_HEIGHT,

  SCRIPT_NODE_SHELL_WIDTH,

  computeScriptNodeFrameSize,

} from "@/lib/scriptNodeChrome";

import { computeVideoNodeFrameSize } from "@/lib/videoGeneration/videoAspectSize";



describe("scriptNodeChrome", () => {

  const videoDefaultFrame = computeVideoNodeFrameSize(16 / 9);



  it("matches video node default 16:9 preview shell", () => {

    expect(SCRIPT_NODE_SHELL_WIDTH).toBe(videoDefaultFrame.width);

    expect(SCRIPT_NODE_SHELL_HEIGHT).toBe(videoDefaultFrame.height);

  });



  it("frame size is fixed regardless of beat count", () => {

    expect(computeScriptNodeFrameSize(false, 0)).toEqual(videoDefaultFrame);

    expect(computeScriptNodeFrameSize(true, 3)).toEqual(videoDefaultFrame);

    expect(computeScriptNodeFrameSize(true, 120)).toEqual(videoDefaultFrame);

  });

});

