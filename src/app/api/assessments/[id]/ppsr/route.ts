import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { runHistoryCheck } from "@/lib/assess/service";

/**
 * POST /api/assessments/[id]/ppsr — phase 2: run the (paid) PPSR history check
 * for an existing price assessment and finalize its verdict.
 *
 * Verifies auth itself (the Proxy excludes /api). 409 if PPSR already ran,
 * 503 on a history-service outage, 404 if the assessment isn't found.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const result = await runHistoryCheck({ supabase, assessmentId: id });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
