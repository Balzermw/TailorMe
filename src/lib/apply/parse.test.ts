import { describe, expect, it } from "vitest";
import { analyze } from "./parse";
import { SAMPLE_RESUME } from "./sample";

describe("resume analysis heuristics", () => {
  it("extracts the name, roles, bullets, metrics, and skills from the sample", () => {
    const s = analyze(SAMPLE_RESUME);
    expect(s.name).toBe("Alex Mercer");
    expect(s.roles).toBeGreaterThanOrEqual(2); // two dated roles
    expect(s.bullets).toBeGreaterThan(3);
    expect(s.metricBullets).toBeGreaterThan(0); // "2.4M", "40k", "38%"
    expect(s.skills).toEqual(
      expect.arrayContaining(["React", "Node.js", "Kubernetes"]),
    );
  });

  it("degrades gracefully on sparse text", () => {
    const s = analyze("Jane Doe\nsome unstructured prose without any tech words");
    expect(s.name).toBe("Jane Doe"); // first ≤4-word, digit-free line
    expect(s.roles).toBeGreaterThanOrEqual(1);
    expect(s.bullets).toBeGreaterThanOrEqual(1);
    expect(s.skills).toEqual([]);
  });
});
