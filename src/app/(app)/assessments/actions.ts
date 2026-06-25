"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Mark an assessment as reviewed. Any authenticated user may review (Slice 1
 * has no roles); the `assessments_update_authenticated` RLS policy allows it.
 */
export async function markReviewed(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("assessments")
    .update({
      review_status: "reviewed",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error("Failed to mark the assessment as reviewed.");
  }

  revalidatePath("/assessments");
  revalidatePath(`/assessments/${id}`);
}
