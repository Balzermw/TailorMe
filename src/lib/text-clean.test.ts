import { describe, expect, it } from "vitest";
import { stripLogoArtifact } from "./text-clean";

describe("stripLogoArtifact", () => {
  it("strips the LinkedIn 'Company logo for, X' boilerplate", () => {
    expect(stripLogoArtifact("Company logo for, Deloitte.")).toBe("Deloitte");
  });

  it("strips a trailing '{Company} logo'", () => {
    expect(stripLogoArtifact("Deloitte logo")).toBe("Deloitte");
    expect(stripLogoArtifact("Microsoft Corporation logo")).toBe("Microsoft Corporation");
  });

  it("leaves text without 'logo' untouched", () => {
    expect(stripLogoArtifact("Lead ServiceNow Software Engineer")).toBe(
      "Lead ServiceNow Software Engineer",
    );
    expect(stripLogoArtifact("Deloitte")).toBe("Deloitte");
  });

  it("does not touch 'logo' inside another word", () => {
    expect(stripLogoArtifact("Technologo Inc")).toBe("Technologo Inc");
  });

  it("handles empty / whitespace", () => {
    expect(stripLogoArtifact("")).toBe("");
    expect(stripLogoArtifact("   ")).toBe("");
  });
});
