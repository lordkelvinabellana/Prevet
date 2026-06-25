import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// Next.js 16 renamed the `middleware` file convention to `proxy`. This runs on
// the Node.js runtime and refreshes the Supabase session before every matched
// request. See node_modules/next/dist/docs/.../proxy.md.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every path EXCEPT:
     * - api          (Route Handlers verify auth themselves; a 307 to /login
     *                 would be wrong for an API caller)
     * - _next/static, _next/image  (build assets)
     * - favicon.ico and common image files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
