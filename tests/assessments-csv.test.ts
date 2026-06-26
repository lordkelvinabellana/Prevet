import { describe, it, expect } from "vitest";
import { csvCell, assessmentsToCsv } from "@/app/(app)/assessments/_csv";
import type { AssessmentListItem } from "@/app/(app)/assessments/_shared";

describe("csvCell", () => {
  it("quotes only when needed and escapes embedded quotes", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
  });
});

describe("assessmentsToCsv", () => {
  const row: AssessmentListItem = {
    id: "a1",
    created_at: "2026-06-26T00:00:00Z",
    recommendation: "buy",
    max_offer: 28712,
    history_status: "checked",
    review_status: "pending",
    purchase_price: 22000,
    cars: {
      year: 2018,
      make: "Toyota",
      model: "Corolla",
      plate: "1ABC123",
      seller_asking_price: 25000,
      photos: [],
    },
  };

  it("emits a header + a row with computed saved-vs-asking", () => {
    const csv = assessmentsToCsv([row]);
    const [header, line] = csv.split("\n");
    expect(header).toContain("Saved vs asking");
    expect(line).toContain("2018 Toyota Corolla");
    expect(line).toContain("22000");
    expect(line.endsWith("3000")).toBe(true); // 25000 − 22000
  });
});
