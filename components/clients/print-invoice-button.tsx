"use client";

/** Reusable "Print this page" button. Pass a label to customise. */
export function PrintInvoiceButton({ label = "Print invoice" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="
        h-10 px-4 rounded-xl text-sm font-medium
        bg-brand-600 text-white shadow-sm hover:bg-brand-700
        transition-colors
      "
    >
      {label}
    </button>
  );
}
