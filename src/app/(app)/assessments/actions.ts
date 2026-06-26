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
 * Delete an assessment: removes its car (RLS `cars_delete_own`), which cascades
 * to the valuation, history check, and the assessment itself. Any photos are
 * removed from storage first. Per-user — RLS scopes every step to the owner.
 */
export async function deleteAssessment(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Find the owning car (+ its photos) via the assessment — RLS-scoped.
  const { data } = await supabase
    .from("assessments")
    .select("car_id, cars(photos)")
    .eq("id", id)
    .maybeSingle();
  const row = data as { car_id: string; cars: { photos: string[] } | null } | null;
  if (!row) {
    // Already gone or not ours — nothing to do.
    revalidatePath("/assessments");
    return;
  }

  const photos = row.cars?.photos ?? [];
  if (photos.length > 0) {
    await supabase.storage.from("car-photos").remove(photos);
  }

  const { error } = await supabase.from("cars").delete().eq("id", row.car_id);
  if (error) {
    throw new Error("Failed to delete the assessment.");
  }

  revalidatePath("/assessments");
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
