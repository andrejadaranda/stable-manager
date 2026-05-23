// Global search service. Powers Cmd+K. Searches horses + clients +
// lessons (upcoming + recent), all in parallel, RLS-scoped by Supabase.
//
// Strategy: ilike `%q%` for "contains" partial match, plus accent
// folding via the `unaccent` extension on BOTH the query and column
// values. Without unaccent, a Lithuanian user typing "zir" never
// matched "Žirgas" — they thought search only worked on whole words.
// Results capped at ~5 per type so the palette stays snappy.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export type SearchHit = {
  id:        string;
  kind:      "horse" | "client" | "lesson";
  title:     string;
  subtitle:  string | null;
  href:      string;
};

export async function search(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const session = await getSession().catch(() => null);
  if (!session) return [];

  const supabase = createSupabaseServerClient();
  const isStaff = session.role === "owner" || session.role === "employee";

  // Hand off to an accent-folded RPC instead of PostgREST .or() — we
  // can't easily call unaccent() through .ilike, and an RPC keeps the
  // query plan + diacritic-folding logic in one place. The RPC returns
  // shape compatible with the existing per-table loops below.
  const [horsesRes, clientsRes, lessonsRes] = await Promise.all([
    supabase.rpc("search_horses",  { p_q: q, p_limit: 5 }),
    isStaff
      ? supabase.rpc("search_clients", { p_q: q, p_limit: 5 })
      : Promise.resolve({ data: null, error: null } as { data: null; error: null }),
    isStaff
      ? supabase.rpc("search_lessons", { p_q: q, p_limit: 5 })
      : Promise.resolve({ data: null, error: null } as { data: null; error: null }),
  ]);

  const out: SearchHit[] = [];

  for (const h of (horsesRes.data ?? []) as Array<{ id: string; name: string; breed: string | null }>) {
    out.push({
      id:       h.id,
      kind:     "horse",
      title:    h.name,
      subtitle: h.breed,
      href:     isStaff ? `/dashboard/horses/${h.id}` : `/dashboard/my-horses/${h.id}`,
    });
  }

  if (isStaff) {
    for (const c of (clientsRes.data ?? []) as Array<{ id: string; full_name: string; email: string | null; phone: string | null }>) {
      out.push({
        id:       c.id,
        kind:     "client",
        title:    c.full_name,
        subtitle: c.email ?? c.phone,
        href:     `/dashboard/clients/${c.id}`,
      });
    }

    for (const l of (lessonsRes.data ?? []) as Array<{
      id: string;
      starts_at: string;
      horse_name: string | null;
      client_name: string | null;
    }>) {
      const horseName  = l.horse_name  ?? "";
      const clientName = l.client_name ?? "";
      const d = new Date(l.starts_at);
      out.push({
        id:       l.id,
        kind:     "lesson",
        title:    `${horseName || "Lesson"} · ${clientName || "—"}`,
        subtitle: d.toLocaleString(undefined, {
          weekday: "short", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        }),
        href:     `/dashboard/calendar?date=${d.toISOString().slice(0, 10)}`,
      });
    }
  }

  return out;
}

function pickName(rel: { name: string } | { name: string }[] | null): string {
  if (!rel) return "";
  if (Array.isArray(rel)) return rel[0]?.name ?? "";
  return rel.name ?? "";
}
function pickFullName(rel: { full_name: string } | { full_name: string }[] | null): string {
  if (!rel) return "";
  if (Array.isArray(rel)) return rel[0]?.full_name ?? "";
  return rel.full_name ?? "";
}
