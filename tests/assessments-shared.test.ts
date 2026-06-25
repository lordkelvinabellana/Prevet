import { describe, it, expect } from "vitest";
import {
  needsPpsr,
  rowStatus,
  buildSortHref,
  carLabel,
  type AssessmentListItem,
} from "@/app/(app)/assessments/_shared";

function item(overrides: Partial<AssessmentListItem> = {}): AssessmentListItem {
  return {
    id: "a1",
    created_at: "2026-06-26T00:00:00Z",
    recommendation: "buy",
    max_offer: 28712,
    history_status: "not_checked",
    review_status: "pending",
    cars: {
      year: 2018,
      make: "Toyota",
      model: "Corolla",
      plate: "1ABC123",
      seller_asking_price: 25000,
    },
    ...overrides,
  };
}

describe("needsPpsr", () => {
  it("true for a priced, not-yet-checked Buy/Check", () => {
    expect(needsPpsr(item())).toBe(true);
    expect(needsPpsr(item({ recommendation: "check" }))).toBe(true);
  });
  it("false for a Pass, an already-checked car, or a null offer", () => {
    expect(needsPpsr(item({ recommendation: "pass" }))).toBe(false);
    expect(needsPpsr(item({ history_status: "checked" }))).toBe(false);
    expect(needsPpsr(item({ max_offer: null, recommendation: "check" }))).toBe(
      false,
    );
  });
});

describe("rowStatus", () => {
  it("prioritises PPSR pending, then reviewed, then pending review", () => {
    expect(rowStatus(item()).label).toBe("PPSR pending");
    expect(
      rowStatus(item({ history_status: "checked", review_status: "reviewed" }))
        .label,
    ).toBe("Reviewed");
    expect(
      rowStatus(
        item({ recommendation: "pass", review_status: "pending" }),
      ).label,
    ).toBe("Pending review");
  });
});

describe("buildSortHref", () => {
  it("sorts ascending on first click and preserves other params", () => {
    const href = buildSortHref({ verdict: "buy" }, "max_offer");
    expect(href).toContain("verdict=buy");
    expect(href).toContain("sort=max_offer");
    expect(href).toContain("dir=asc");
  });
  it("flips to descending when the column is already sorted ascending", () => {
    const href = buildSortHref({ sort: "max_offer", dir: "asc" }, "max_offer");
    expect(href).toContain("dir=desc");
  });
});

describe("carLabel", () => {
  it("formats the car, or falls back when missing", () => {
    expect(carLabel(item().cars)).toBe("2018 Toyota Corolla");
    expect(carLabel(null)).toBe("Unknown car");
  });
});
