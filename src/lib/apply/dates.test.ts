import { describe, expect, it } from "vitest";
import { cleanResumeDate, cleanResumeDocDates } from "./dates";
import type { TailoredDoc } from "@/lib/types";

describe("resume date cleanup", () => {
  it("removes imported duration suffixes from date ranges", () => {
    expect(cleanResumeDate("Apr 2026 - Present \u00b7 3 mos")).toBe("Apr 2026 - Present");
    expect(cleanResumeDate("Feb 2025 - Apr 2026 \u00b7 1 yr 3 mos")).toBe(
      "Feb 2025 - Apr 2026",
    );
    expect(cleanResumeDate("Jan 2022 - Present (4 years 2 months)")).toBe(
      "Jan 2022 - Present",
    );
  });

  it("keeps normal date ranges and non-date text alone", () => {
    expect(cleanResumeDate("Jan 2022 - Present")).toBe("Jan 2022 - Present");
    expect(cleanResumeDate("15+ years experience")).toBe("15+ years experience");
  });

  it("cleans all structured date fields without changing other content", () => {
    const doc: TailoredDoc = {
      name: "A B",
      headline: "H",
      contact: "c",
      summary: "s",
      experience: [
        {
          role: "R",
          company: "C",
          dates: "Apr 2026 - Present \u00b7 3 mos",
          bullets: ["b"],
        },
      ],
      education: [{ degree: "D", school: "S", dates: "2020 - 2024" }],
      certifications: [{ name: "Cert", issuer: "Org", date: "Jan 2024 \u00b7 1 mo" }],
      skills: ["x"],
      coverLetter: "l",
    };

    const cleaned = cleanResumeDocDates(doc);
    expect(cleaned.experience[0].dates).toBe("Apr 2026 - Present");
    expect(cleaned.education?.[0].dates).toBe("2020 - 2024");
    expect(cleaned.certifications?.[0].date).toBe("Jan 2024");
    expect(cleaned.experience[0].role).toBe("R");
  });
});
