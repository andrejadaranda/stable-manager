// Invoice requests — a client asks their stable to issue an invoice and
// says what for. Staff see pending requests on finance > invoices and
// fulfil them (generate a real invoice) or dismiss them.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { generateInvoiceForClient } from "@/services/invoices";

export type InvoiceRequestRow = {
  id:         string;
  client_id:  string;
  note:       string | null;
  status:     "pending" | "fulfilled" | "dismissed";
  created_at: string;
};

export type InvoiceRequestForStaff = InvoiceRequestRow & {
  client_name: string | null;
};

// ---- client ----

export async function createInvoiceRequest(note: string | null): Promise<void> {
  const session = await getSession();
  if (session.role !== "client") throw new Error("FORBIDDEN");
  if (!session.clientId) throw new Error("CLIENT_NOT_LINKED");

  const clean = (note ?? "").trim().slice(0, 1000);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("invoice_requests").insert({
    stable_id:  session.stableId,
    client_id:  session.clientId,
    note:       clean || null,
    created_by: session.userId,
  });
  if (error) throw error;
}

export async function listMyInvoiceRequests(): Promise<InvoiceRequestRow[]> {
  const session = await getSession();
  if (session.role !== "client") throw new Error("FORBIDDEN");
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invoice_requests")
    .select("id, client_id, note, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as InvoiceRequestRow[];
}

export async function cancelInvoiceRequest(requestId: string): Promise<void> {
  const session = await getSession();
  if (session.role !== "client") throw new Error("FORBIDDEN");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("invoice_requests")
    .delete()
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw error;
}

// ---- staff ----

export async function listPendingInvoiceRequests(): Promise<InvoiceRequestForStaff[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invoice_requests")
    .select("id, client_id, note, status, created_at, client:clients(full_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as unknown as {
      id: string; client_id: string; note: string | null;
      status: "pending" | "fulfilled" | "dismissed"; created_at: string;
      client: { full_name: string | null } | { full_name: string | null }[] | null;
    };
    const c = Array.isArray(row.client) ? row.client[0] : row.client;
    return {
      id:          row.id,
      client_id:   row.client_id,
      note:        row.note,
      status:      row.status,
      created_at:  row.created_at,
      client_name: c?.full_name ?? null,
    };
  });
}

export async function countPendingInvoiceRequests(): Promise<number> {
  const session = await getSession();
  if (session.role !== "owner" && session.role !== "employee") return 0;
  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("invoice_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}

/** Generate an invoice for the requesting client, then mark the request
 *  fulfilled and link the invoice. Returns the new invoice id (or null if
 *  there was nothing un-invoiced to bill). */
export async function fulfillInvoiceRequest(requestId: string): Promise<string | null> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();

  const { data: req, error: rErr } = await supabase
    .from("invoice_requests")
    .select("id, client_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (rErr) throw rErr;
  if (!req) throw new Error("REQUEST_NOT_FOUND");
  const r = req as { id: string; client_id: string; status: string };
  if (r.status !== "pending") throw new Error("ALREADY_HANDLED");

  const { id: invoiceId } = await generateInvoiceForClient(r.client_id);
  if (!invoiceId) throw new Error("NOTHING_TO_INVOICE");

  const { error: uErr } = await supabase
    .from("invoice_requests")
    .update({ status: "fulfilled", fulfilled_invoice_id: invoiceId })
    .eq("id", requestId);
  if (uErr) throw uErr;

  return invoiceId;
}

export async function dismissInvoiceRequest(requestId: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("invoice_requests")
    .update({ status: "dismissed" })
    .eq("id", requestId);
  if (error) throw error;
}
