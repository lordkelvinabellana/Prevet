import { getUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { fetchFilteredAssessments } from "@/app/(app)/assessments/_query";
import { assessmentsToCsv } from "@/app/(app)/assessments/_csv";

/**
 * GET /api/assessments/export — download the assessments as CSV, honouring the
 * same filters as the dashboard (so the "Purchased" filter → a deals export).
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const supabase = await createClient();
  const { rows } = await fetchFilteredAssessments(supabase, sp);

  return new Response(assessmentsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="assessments.csv"',
    },
  });
}
