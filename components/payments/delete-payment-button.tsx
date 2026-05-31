"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePaymentAction } from "@/app/dashboard/payments/actions";

export function DeletePaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, startT] = useTransition();

  function onDelete() {
    if (!confirm("Delete this payment? The client's balance will update.")) return;
    startT(async () => {
      const res = await deletePaymentAction(paymentId);
      if (res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="text-[12px] text-ink-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg px-2 py-1 transition-colors disabled:opacity-50"
      aria-label="Delete payment"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}
