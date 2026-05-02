"use client";

// 2FA TOTP setup panel. Three states:
//
//   1. Idle / no factor          → "Set up 2FA" button
//   2. Enrolling (factor created) → QR code + secret + verify input
//   3. Verified factors list     → status pill + remove button
//
// QR code comes from Supabase as an SVG markup string (data.totp.qr_code).
// We render it via dangerouslySetInnerHTML — pre-rendered SVG, not user
// input, so safe to inline.

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  startEnrollAction,
  verifyEnrollAction,
  unenrollAction,
  type EnrollState,
  type VerifyState,
  type UnenrollState,
} from "@/app/dashboard/settings/security/actions";
import type { MfaFactor } from "@/services/mfa";

const enrollInitial:   EnrollState   = { error: null, enroll: null };
const verifyInitial:   VerifyState   = { error: null, success: false };
const unenrollInitial: UnenrollState = { error: null };

export function MfaPanel({ factors }: { factors: MfaFactor[] }) {
  const verified   = factors.filter((f) => f.status === "verified");
  const [enrollState, dispatchStart] = useFormState<EnrollState, FormData>(startEnrollAction, enrollInitial);
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* Existing verified factors */}
      {verified.length > 0 && (
        <ul className="flex flex-col gap-2">
          {verified.map((f) => (
            <FactorRow key={f.id} factor={f} />
          ))}
        </ul>
      )}

      {/* Enrolling state */}
      {enrollState.enroll ? (
        <div className="bg-brand-50/40 rounded-xl border border-brand-200 p-4">
          <h4 className="text-sm font-semibold text-navy-900">Scan the QR code</h4>
          <p className="text-[12.5px] text-ink-700 mt-1 leading-relaxed">
            Open your authenticator app (1Password, Authy, Google Authenticator, etc.) and
            scan this QR. Then enter the 6-digit code below to confirm.
          </p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4">
            <div
              className="bg-white rounded-xl p-3 self-start ring-1 ring-ink-100 shrink-0"
              dangerouslySetInnerHTML={{ __html: enrollState.enroll.qrCodeSvg }}
              aria-label="2FA QR code"
              role="img"
            />
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="text-[11.5px] text-ink-500 hover:text-ink-900 self-start"
              >
                {showSecret ? "Hide secret" : "Can't scan? Show secret to type manually"}
              </button>
              {showSecret && (
                <code className="text-[11px] tabular-nums bg-white border border-ink-200 rounded-lg px-3 py-2 break-all">
                  {enrollState.enroll.secret}
                </code>
              )}

              <VerifyForm factorId={enrollState.enroll.factorId} />
            </div>
          </div>
        </div>
      ) : (
        verified.length === 0 && (
          <form action={dispatchStart}>
            <button
              type="submit"
              className="
                h-10 px-4 rounded-xl text-sm font-medium
                bg-brand-600 text-white shadow-sm hover:bg-brand-700
                transition-colors
              "
            >
              Set up 2FA
            </button>
            {enrollState.error && (
              <p className="text-[12px] text-rose-700 mt-2" role="alert">
                {enrollState.error}
              </p>
            )}
          </form>
        )
      )}
    </div>
  );
}

function VerifyForm({ factorId }: { factorId: string }) {
  const [state, dispatch] = useFormState<VerifyState, FormData>(verifyEnrollAction, verifyInitial);
  // After success, the page revalidates and the verified factor takes
  // over — no extra client-side state needed.
  useEffect(() => { /* tracked via revalidatePath */ }, [state.success]);

  return (
    <form action={dispatch} className="flex flex-col gap-2">
      <input type="hidden" name="factor_id" value={factorId} />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[12px] font-medium text-ink-700">6-digit code</span>
        <input
          name="code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          autoComplete="one-time-code"
          required
          maxLength={6}
          placeholder="123456"
          className="
            w-full bg-white text-ink-900 placeholder:text-ink-400 tabular-nums tracking-[0.4em]
            rounded-lg border border-ink-200 px-3.5 py-2.5 text-center font-mono text-base
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        />
      </label>
      <VerifySubmit />
      {state.error && (
        <p className="text-[12px] text-rose-700" role="alert">{state.error}</p>
      )}
    </form>
  );
}

function VerifySubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-10 px-4 rounded-xl text-sm font-medium
        bg-navy-900 text-white shadow-sm hover:bg-navy-800 disabled:opacity-60
        transition-colors self-start
      "
    >
      {pending ? "Verifying…" : "Verify and turn on"}
    </button>
  );
}

function FactorRow({ factor }: { factor: MfaFactor }) {
  const [state, dispatch] = useFormState<UnenrollState, FormData>(unenrollAction, unenrollInitial);
  return (
    <li className="bg-emerald-50/50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <span
        className="w-7 h-7 rounded-lg bg-emerald-600 text-white inline-flex items-center justify-center text-xs"
        aria-hidden
      >
        ✓
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-navy-900">
          {factor.friendly_name ?? "Authenticator app"}
        </p>
        <p className="text-[11px] text-ink-500">
          Added {new Date(factor.created_at).toLocaleDateString()}
        </p>
      </div>
      <form action={dispatch}>
        <input type="hidden" name="factor_id" value={factor.id} />
        <UnenrollButton />
      </form>
      {state.error && (
        <p className="text-[11px] text-rose-700 ml-2" role="alert">
          {state.error}
        </p>
      )}
    </li>
  );
}

function UnenrollButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        text-[12px] text-ink-500 hover:text-rose-700
        underline-offset-2 hover:underline
        disabled:opacity-60
      "
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
