// GET /api/search?q=… — JSON endpoint backing the Cmd+K palette.
// Lives behind the same RLS as the rest of the app (cookie-auth'd).

import { NextResponse } from "next/server";
import { search } from "@/services/search";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  try {
    const hits = await search(q);
    return NextResponse.json({ hits });
  } catch {
    return NextResponse.json({ hits: [] }, { status: 200 });
  }
}
