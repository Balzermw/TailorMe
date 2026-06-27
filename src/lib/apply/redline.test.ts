import { describe, expect, it } from "vitest";
import { wordDiff, type RedlineSeg } from "./redline";

function join(segs: RedlineSeg[], kinds: RedlineSeg["type"][]): string {
  return segs
    .filter((s) => kinds.includes(s.type))
    .map((s) => s.text)
    .join("");
}

describe("wordDiff", () => {
  it("only marks the words that actually changed", () => {
    const before =
      "Developed, tested, and integrated RF sensor systems based on detailed hardware and software requirements.";
    const after =
      "Implemented and integrated RF sensor systems based on detailed hardware and software requirements.";
    const segs = wordDiff(before, after);

    // The long unchanged tail must stay equal, not be struck out.
    const equalText = join(segs, ["equal"]);
    expect(equalText).toContain(
      "integrated RF sensor systems based on detailed hardware and software requirements.",
    );

    // Something was removed and something was added (not the whole sentence).
    expect(segs.some((s) => s.type === "removed")).toBe(true);
    expect(segs.some((s) => s.type === "added")).toBe(true);
    expect(join(segs, ["removed"])).toContain("Developed");
    expect(join(segs, ["added"])).toContain("Implemented");

    // The removed run must be a small fraction of the sentence, not all of it.
    expect(join(segs, ["removed"]).length).toBeLessThan(before.length / 2);
  });

  it("reconstructs both sides exactly (equal+removed = before, equal+added = after)", () => {
    const before = "Led a team of 5 engineers across two product lines.";
    const after = "Led a cross-functional team of 8 engineers across two product lines.";
    const segs = wordDiff(before, after);
    expect(join(segs, ["equal", "removed"])).toBe(before);
    expect(join(segs, ["equal", "added"])).toBe(after);
  });

  it("returns a single equal run when nothing changed", () => {
    const s = "Owned the billing service end to end.";
    const segs = wordDiff(s, s);
    expect(segs).toEqual([{ type: "equal", text: s }]);
  });

  it("handles a full replacement (no shared words)", () => {
    const segs = wordDiff("alpha beta", "gamma delta");
    // No real word survives as unchanged (only whitespace may match).
    expect(join(segs, ["equal"]).trim()).toBe("");
    // Reconstruction invariants still hold.
    expect(join(segs, ["equal", "removed"])).toBe("alpha beta");
    expect(join(segs, ["equal", "added"])).toBe("gamma delta");
  });

  it("handles empty strings on either side", () => {
    expect(join(wordDiff("", "new text"), ["added"])).toBe("new text");
    expect(join(wordDiff("old text", ""), ["removed"])).toBe("old text");
    expect(wordDiff("", "")).toEqual([]);
  });
});
