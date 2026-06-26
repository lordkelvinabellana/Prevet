import { needsPpsr, carLabel, type AssessmentListItem } from "./_shared";

/** Quote a CSV cell if it contains a comma, quote, or newline. */
export function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const HEADER = [
  "Date",
  "Car",
  "Plate",
  "Verdict",
  "Max offer",
  "Asking",
  "PPSR",
  "Review",
  "Purchased",
  "Price paid",
  "Saved vs asking",
];

export function assessmentsToCsv(rows: AssessmentListItem[]): string {
  const lines = [HEADER.join(",")];
  for (const r of rows) {
    const asking =
      r.cars?.seller_asking_price == null
        ? null
        : Number(r.cars.seller_asking_price);
    const price = r.purchase_price == null ? null : Number(r.purchase_price);
    const saved = asking != null && price != null ? asking - price : null;
    const cells = [
      r.created_at,
      carLabel(r.cars),
      r.cars?.plate ?? "",
      r.recommendation,
      r.max_offer == null ? "" : String(Number(r.max_offer)),
      asking == null ? "" : String(asking),
      r.history_status === "checked" ? "checked" : needsPpsr(r) ? "pending" : "",
      r.review_status,
      price != null ? "yes" : "no",
      price == null ? "" : String(price),
      saved == null ? "" : String(saved),
    ];
    lines.push(cells.map((c) => csvCell(String(c))).join(","));
  }
  return lines.join("\n");
}
