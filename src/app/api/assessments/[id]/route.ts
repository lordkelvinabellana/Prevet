import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { parseCarInput } from "@/lib/validation/schema";
import { reassessInPlace } from "@/lib/assess/service";

/**
 * PATCH /api/assessments/[id] — apply edited car details and re-run the
 * deterministic engine in place. Same validation + error shape as POST /api/assess
 * (400 fields, 409 duplicate_vin, 503 adapter outage). Auth verified here (the
 * proxy excludes /api).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseCarInput(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Validation failed.", fields: parsed.errors },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const result = await reassessInPlace({
    supabase,
    assessmentId: id,
    input: parsed.data,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        existingAssessmentId: result.existingAssessmentId,
      },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
