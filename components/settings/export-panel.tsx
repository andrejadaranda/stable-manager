// Settings → Stable → Download my data.
//
// Owner-only. One CSV per data type — clicking the button hits
// /api/export/<type> which streams the CSV back as a download. RLS
// inside the route narrows to the caller's stable so there's no way
// to accidentally pull another tenant's rows.

const EXPORTS: Array<{ key: string; label: string; hint: string }> = [
  { key: "clients",          label: "Clients",          hint: "Roster + skill levels + balances baseline." },
  { key: "horses",           label: "Horses",           hint: "Roster + workload caps + ownership + boarding fee." },
  { key: "lessons",          label: "Lessons",          hint: "Every booking with status + price + welfare overrides." },
  { key: "payments",         label: "Payments",         hint: "Full ledger of money in." },
  { key: "packages",         label: "Lesson packages",  hint: "Prepaid bundles per client." },
  { key: "boarding_charges", label: "Boarding charges", hint: "Monthly livery line items." },
  { key: "misc_charges",     label: "Misc charges",     hint: "Farrier, equipment, vet co-pay, etc." },
  { key: "expenses",         label: "Stable expenses",  hint: "Feed, vet, farrier, maintenance, staff." },
  { key: "services",         label: "Services",         hint: "Your price list." },
  { key: "agreements",       label: "Agreements",       hint: "Signed documents per client." },
  { key: "sessions",         label: "Ride sessions",    hint: "Logged training sessions." },
  { key: "reminders",        label: "Reminders",        hint: "Open + completed reminders." },
];

export function ExportPanel() {
  return (
    <section className="bg-white rounded-2xl shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-ink-100">
        <h2 className="text-sm font-semibold text-navy-900">
          Download my data
        </h2>
        <p className="text-[12.5px] text-ink-500 mt-0.5">
          Every table as a CSV. Open in Excel, Numbers, or Sheets — or
          archive as a backup. GDPR data portability built-in.
        </p>
      </div>
      <ul className="divide-y divide-ink-100">
        {EXPORTS.map((e) => (
          <li
            key={e.key}
            className="px-5 py-3 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy-900">{e.label}</p>
              <p className="text-[11.5px] text-ink-500 mt-0.5">{e.hint}</p>
            </div>
            <a
              href={`/api/export/${e.key}`}
              download
              className="
                shrink-0 h-9 px-3.5 rounded-xl text-[12.5px] font-medium
                bg-white text-ink-700 hover:bg-ink-100/60 border border-ink-200
                transition-colors
              "
            >
              Download CSV
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
