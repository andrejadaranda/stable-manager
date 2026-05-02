// Global search service. Powers Cmd+K. Searches horses + clients +
// lessons (upcoming + recent), all in parallel, RLS-scoped by Supabase.
//
// Strategy: simple ilike on name fields. Results capped at ~5 per
// type so the palette stays snappy and uncluttered. Server-side so
// we don't ship the row data to the client until it's needed.

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
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const isStaff = session.role === "owner" || session.role === "employee";

  // Run sub-queries in parallel; any failure -> empty list for that
  // category, so a partial outage doesn't kill the palette.
  const [horsesRes, clientsRes, lessonsRes] = await Promise.all([
    supabase
      .from("horses")
      .select("id, name, breed")
      .or(`name.ilike.${like},breed.ilike.${like}`)
      .limit(5),
    isStaff
      ? supabase
          .from("clients")
          .select("id, full_name, email, phone")
          .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
          .limit(5)
      : Promise.resolve({ data: null, error: null } as { data: null; error: null }),
    isStaff
      ? supabase
          .from("lessons")
          .select("id, starts_at, horses!inner(name), clients!inner(full_name)")
          .or(`name.ilike.${like}`, { foreignTable: "horses" })
          .limit(5)
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
      horses: { name: string } | { name: string }[] | null;
      clients: { full_name: string } | { full_name: string }[] | null;
    }>) {
      const horseName  = pickName(l.horses);
      const clientName = pickFullName(l.clients);
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
