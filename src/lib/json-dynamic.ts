import { NextResponse } from "next/server";

/** JSON response that must never be cached (live markets, session, todos). */
export function jsonDynamic(
  data: unknown,
  init?: { status?: number }
): NextResponse {
  return NextResponse.json(data, {
    status: init?.status,
    headers: {
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
