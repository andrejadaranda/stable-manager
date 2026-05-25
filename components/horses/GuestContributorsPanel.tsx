"use client";

// Sprint 4 W2 — owner UI for minting + revoking guest contributor
// links. Lives at the bottom of the Health tab. Strategic moat play:
// each link a stable hands out makes Longrein the system of record
// for that external pro (vet / farrier) — sticky network effect.

import { useFormState, useFormStatus } from "react-dom";
import { useState, useTransition } from "react";
import {
  createGuestTokenAction,
  initialCreateGuestTokenState,
  revokeGuestTokenAction,
  type CreateGuestTokenState,
} from "@/app/dashboard/horses/[id]/guest-actions";
import {
  KIND_LABEL,
  type GuestContributorKind,
  type GuestContributorToken,
} from "@/services/guestContributors.pure";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function GuestContributorsPanel({
  horseId,
  initialTokens,
  appOrigin,
}: {
  horseId: string;
  initialTokens: GuestContributorToken[];
  appOrigin: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [tokens, setTokens] = useState(initialTokens);
  const activeTokens = tokens.filter((t) => !t.revoked_at && new Date(t.expires_at) > new Date());

  const [createState, createAction] = useFormState<CreateGuestTokenState, FormData>(
    createGuestTokenAction,
    initialCreateGuestTokenState,
  );

  return (
    <section className="card-elevated overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Guest contributors</h2>
          <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-500 font-semibold">
            external vet / farrier
          </span>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-800 hover:bg-ink-50"
          >
            + Invite contributor
          </button>
        )}
      </header>

      {!showForm && tokens.length === 0 && (
        <div className="p-6 text-center">
          <p className="text-sm text-ink-500 max-w-md mx-auto">
            Send your vet or farrier a magic-link so they can post visits directly into this horse's log — no account needed. You can revoke any link instantly.
          </p>
        </div>
      )}

      {showForm && (
        <form action={createAction} className="p-5 flex flex-col gap-4 border-b border-ink-100 bg-cream-50/60">
          <input type="hidden" name="horse_id" value={horseId} />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-[0.12em] font-semibold text-ink-500">Kind</span>
              <select
                name="kind"
                required
                defaultValue="vet"
                className="border border-ink-200 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="vet">Vet</option>
                <option value="farrier">Farrier</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-[0.12em] font-semibold text-ink-500">Contributor name</span>
              <input
                type="text"
                name="contributor_name"
                required
                maxLength={80}
                placeholder="e.g. Dr. Linas K. (DVM)"
                className="border border-ink-200 rounded-md px-3 py-2 text-sm bg-white"
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <CreateSubmit />
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-ink-500 hover:text-ink-900"
            >
              Cancel
            </button>
          </div>
          {createState.error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {createState.error}
            </p>
          )}
          {createState.shareUrl && (
            <ShareUrlPanel shareUrl={createState.shareUrl} />
          )}
        </form>
      )}

      {tokens.length > 0 && (
        <ul className="divide-y divide-ink-100">
          {tokens.map((t) => (
            <TokenRow
              key={t.id}
              token={t}
              appOrigin={appOrigin}
              horseId={horseId}
              onRevoked={(id) =>
                setTokens((prev) => prev.map((x) => (x.id === id ? { ...x, revoked_at: new Date().toISOString() } : x)))
              }
            />
          ))}
        </ul>
      )}

      {activeTokens.length === 0 && tokens.length > 0 && (
        <p className="px-5 py-3 text-[11px] text-ink-500">
          No active links. Mint a new one above.
        </p>
      )}
    </section>
  );
}

function CreateSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Creating…" : "Create link"}
    </button>
  );
}

function ShareUrlPanel({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex flex-col gap-2">
      <p className="text-xs font-semibold text-emerald-900 uppercase tracking-[0.12em]">
        Link ready — copy + send
      </p>
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          readOnly
          value={shareUrl}
          className="flex-1 min-w-0 border border-emerald-300 rounded-md px-2.5 py-1.5 text-xs bg-white font-mono"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          type="button"
          onClick={copy}
          className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <p className="text-[11px] text-emerald-800">
        Anyone with this link can log entries for this horse for the next 90 days. You can revoke any time below.
      </p>
    </div>
  );
}

function TokenRow({
  token,
  appOrigin,
  horseId,
  onRevoked,
}: {
  token: GuestContributorToken;
  appOrigin: string;
  horseId: string;
  onRevoked: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const expired = new Date(token.expires_at) <= new Date();
  const isRevoked = !!token.revoked_at;
  const isInactive = expired || isRevoked;
  const shareUrl = `${appOrigin}/guest/log/${token.token}`;

  const stateLabel = isRevoked
    ? "Revoked"
    : expired
    ? "Expired"
    : `Active · expires ${fmtDate(token.expires_at)}`;

  const revoke = () => {
    if (!confirm("Revoke this link? The contributor will lose access immediately. This can't be undone.")) return;
    startTransition(async () => {
      const res = await revokeGuestTokenAction(token.id, horseId);
      if (res.ok) onRevoked(token.id);
    });
  };

  const copyLink = () => {
    void navigator.clipboard.writeText(shareUrl);
  };

  return (
    <li className="px-5 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900 truncate">
          {token.contributor_name}{" "}
          <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-500 font-semibold ml-1.5">
            {KIND_LABEL[token.kind as GuestContributorKind] ?? token.kind}
          </span>
        </p>
        <p className="text-[11.5px] text-ink-500 mt-0.5">
          {stateLabel} · {token.use_count} entries
          {token.last_used_at ? ` · last on ${fmtDate(token.last_used_at)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!isInactive && (
          <>
            <button
              type="button"
              onClick={copyLink}
              className="text-xs text-ink-600 hover:text-ink-900 underline"
            >
              Copy link
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={revoke}
              className="text-xs text-red-700 hover:text-red-900 underline disabled:opacity-50"
            >
              Revoke
            </button>
          </>
        )}
      </div>
    </li>
  );
}
