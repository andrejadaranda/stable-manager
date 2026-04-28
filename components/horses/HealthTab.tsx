// Health & care tab — three status cards on top, timeline below,
// inline +Add record (staff only). Server component for the layout;
// the add form + delete buttons are client subcomponents.

import type {
  HealthRecord,
  HealthSummary,
  HealthSummaryStatus,
} from "@/services/horseHealth";
import { AddHealthRecordButton } from "./AddHealthRecordForm";
import { ResolveInjuryButton, DeleteHealthRecordButton } from "./HealthRecordActions";

const KIND_LABEL = {
  vaccination: "Vaccinations",
  farrier:     "Farrier",
  vet:         "Vet",
  injury:      "Injury",
} as const;

const STATUS_LABEL: Record<HealthSummaryStatus, string> = {
  ok:       "Up to date",
  due_soon: "Due soon",
  overdue:  "Overdue",
  none:     "No record yet",
};

const STATUS_TONE: Record<HealthSummaryStatus, { border: string; chip: string; chipBg: string }> = {
  ok:       { border: "#5A7A3A", chip: "#3F5A1F", chipBg: "#EDF1E5" },
  due_soon: { border: "#C2841A", chip: "#854F0B", chipBg: "#FAEEDA" },
  overdue:  { border: "#B23838", chip: "#791F1F", chipBg: "#FCEBEB" },
  none:     { border: "#B0A89E", chip: "#5F5E5A", chipBg: "#F1EFE8" },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function HealthTab({
  horseId,
  summary,
  records,
}: {
  horseId: string;
  summary: HealthSummary;
  records: HealthRecord[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {summary.active_injury && (
        <ActiveInjuryBanner
          horseId={horseId}
          recordId={records.find((r) => r.kind === "injury" && !r.resolved_on)?.id ?? ""}
          title={summary.active_injury.title}
          since={summary.active_injury.occurred_on}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatusCard label="Vaccinations" data={summary.vaccination} />
        <StatusCard label="Farrier"      data={summary.farrier} />
        <StatusCard label="Vet"          data={summary.vet} />
      </div>

      <section className="card-elevated overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
          <h2 className="text-sm font-semibold text-ink-900">Timeline</h2>
          <AddHealthRecordButton horseId={horseId} />
        </header>

        {records.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-ink-500 max-w-xs mx-auto">
              No health records yet. Add the first one — vaccinations, farrier visits, vet visits, or injuries.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {records.map((r) => (
              <RecordRow key={r.id} record={r} horseId={horseId} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusCard({
  label,
  data,
}: {
  label: string;
  data: { status: HealthSummaryStatus; next_due_on: string | null; last_occurred_on: string | null };
}) {
  const tone = STATUS_TONE[data.status];
  return (
    <div
      className="rounded-2xl p-4 bg-white border border-ink-100"
      style={{ borderLeft: `3px solid ${tone.border}` }}
    >
      <div className="text-[10.5px] tracking-[0.04em] uppercase text-ink-500">{label}</div>
      <div className="text-[15px] font-medium text-ink-900 mt-1">{STATUS_LABEL[data.status]}</div>
      <div className="text-[11.5px] text-ink-500 mt-1">
        {data.next_due_on
          ? `Next due ${fmtDate(data.next_due_on)}`
          : data.last_occurred_on
            ? `Last on ${fmtDate(data.last_occurred_on)}`
            : "Add the first record below"}
      </div>
    </div>
  );
}

function ActiveInjuryBanner({
  horseId,
  recordId,
  title,
  since,
}: {
  horseId: string;
  recordId: string;
  title: string;
  since: string;
}) {
  return (
    <div
      className="card-elevated p-4 flex items-start gap-3"
      style={{ borderLeft: `3px solid #B23838` }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[11px] tracking-[0.04em] uppercase text-rose-700 font-medium">
          Active injury
        </div>
        <div className="text-[14px] font-medium text-ink-900 mt-1">{title}</div>
        <div className="text-[11.5px] text-ink-500 mt-0.5">Since {fmtDate(since)}</div>
      </div>
      {recordId && <ResolveInjuryButton recordId={recordId} horseId={horseId} />}
    </div>
  );
}

function RecordRow({ record, horseId }: { record: HealthRecord; horseId: string }) {
  const tone =
    record.kind === "injury"
      ? STATUS_TONE[record.resolved_on ? "ok" : "overdue"]
      : record.next_due_on
        ? STATUS_TONE[
            (() => {
              const d = Math.round(
                (new Date(record.next_due_on).getTime() - Date.now()) / 86400000,
              );
              if (d < 0) return "overdue";
              if (d <= 30) return "due_soon";
              return "ok";
            })()
          ]
        : STATUS_TONE.ok;

  return (
    <li className="px-5 py-3.5 flex items-start gap-4">
      <div className="shrink-0 w-20 text-[11px] text-ink-500 pt-0.5">{fmtDate(record.occurred_on)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: tone.chipBg, color: tone.chip }}
          >
            {KIND_LABEL[record.kind]}
          </span>
          <span className="text-[14px] text-ink-900 font-medium">{record.title}</span>
          {record.kind === "injury" && record.resolved_on && (
            <span className="text-[11px] text-ink-500">resolved {fmtDate(record.resolved_on)}</span>
          )}
        </div>
        {record.next_due_on && record.kind !== "injury" && (
          <div className="text-[11.5px] text-ink-500 mt-1">Next due {fmtDate(record.next_due_on)}</div>
        )}
        {record.notes && (
          <p className="text-[12.5px] text-ink-700 mt-1.5 leading-relaxed line-clamp-3">{record.notes}</p>
        )}
      </div>
      <DeleteHealthRecordButton recordId={record.id} horseId={horseId} />
    </li>
  );
}
