"use client";

// Minimal client-side print trigger. The InvoicePrintView applies its own
// print isolation CSS, so window.print() yields a clean A4 / PDF.

export function PrintInvoiceButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="text-[13px] text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg font-medium"
    >
      Print / Save PDF
    </button>
  );
}
