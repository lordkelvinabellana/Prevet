import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { parseCarInput } from "@/lib/validation/schema";
import { runAssessment } from "@/lib/assess/service";

/**
 * POST /api/assess — run a deterministic pre-vetting assessment for one car.
 *
 * The Proxy excludes /api, so this handler verifies the session itself (the
 * pattern the Next.js auth guide recommends for Route Handlers).
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

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
  const result = await runAssessment({ supabase, input: parsed.data });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
