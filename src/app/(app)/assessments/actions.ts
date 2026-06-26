"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Mark an assessment as reviewed. Any authenticated user may review (Slice 1
 * has no roles); the `assessments_update_authenticated` RLS policy allows it.
 */
export async function markReviewed(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const raw = formData.get("note");
  const note = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;

  const { error } = await supabase
    .from("assessments")
    .update({
      review_status: "reviewed",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_note: note,
    })
    .eq("id", id);

  if (error) {
    throw new Error("Failed to mark the assessment as reviewed.");
  }

  revalidatePath("/assessments");
  revalidatePath(`/assessments/${id}`);
}

/**
 * Record the actual purchase of an assessed car (price paid + optional note),
 * so spend and savings-vs-asking can be reported. Any authenticated user may
 * record it (Slice 1 has no roles); the RLS update policy allows it.
 */
export async function recordPurchase(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const raw = formData.get("price");
  const price = typeof raw === "string" ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Enter a valid purchase price.");
  }
  const noteRaw = formData.get("note");
  const note =
    typeof noteRaw === "string" && noteRaw.trim() !== "" ? noteRaw.trim() : null;

  const { error } = await supabase
    .from("assessments")
    .update({
      purchase_price: price,
      purchased_at: new Date().toISOString(),
      purchased_by: user.id,
      purchase_note: note,
    })
    .eq("id", id);

  if (error) {
    throw new Error("Failed to record the purchase.");
  }

  revalidatePath("/assessments");
  revalidatePath(`/assessments/${id}`);
}
