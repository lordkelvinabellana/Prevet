import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/cars/vin-check?vin=… — has the signed-in user already assessed a car
 * with this VIN? Drives the on-blur duplicate warning in the assess form.
 *
 * RLS-scoped, so it only ever reports the caller's own listings. The Proxy
 * excludes /api, so this verifies the session itself.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const vin = new URL(request.url).searchParams.get("vin")?.trim().toUpperCase();
  if (!vin) {
    return NextResponse.json({ exists: false });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("assessments")
    .select("id, created_at, cars!inner(vin)")
    .ilike("cars.vin", vin)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as { id: string; created_at: string } | null;
  if (!row) {
    return NextResponse.json({ exists: false });
  }
  return NextResponse.json({
    exists: true,
    assessmentId: row.id,
    createdAt: row.created_at,
  });
}
