import { describe, expect, it } from "vitest";
import { judgeQuality } from "./image-tools";

const ok = { meanLuma: 150, sharpness: 200, width: 1200, height: 1600 };

describe("scan photo quality", () => {
  it("accepts a clear, well-lit photo", () => expect(judgeQuality(ok)).toEqual([]));
  it("flags a dark photo", () => expect(judgeQuality({ ...ok, meanLuma: 40 })).toContain("dark"));
  it("flags a washed-out photo", () => expect(judgeQuality({ ...ok, meanLuma: 253 })).toContain("bright"));
  it("flags a blurry photo", () => expect(judgeQuality({ ...ok, sharpness: 10 })).toContain("blurry"));
  it("flags a tiny photo", () => expect(judgeQuality({ ...ok, width: 300 })).toContain("small"));
});
