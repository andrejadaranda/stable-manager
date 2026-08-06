// Screen 5 — Rinkodara. What she posted, what worked, what's missing.

import Link from "next/link";
import { getMarketingSnapshot } from "@/services/personalDashboard/marketing";
import { getStableTimeZone } from "@/services/personalDashboard/common";
import {
  ScreenHeader,
  Section,
  Panel,
  Metric,
  Chip,
  Row,
  Empty,
  formatDay,
} from "@/components/personal/ui";
import { ActionButton } from "@/components/personal/interactive";
import { refreshMarketing } from "@/app/personal/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rinkodara" };

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  website: "tjk.lt",
};

export default async function MarketingScreen() {
  const now = new Date();
  const tz = await getStableTimeZone();
  const m = await getMarketingSnapshot(now);

  const anyData = m.posts.length > 0;

  return (
    <>
      <ScreenHeader
        eyebrow="Turinys"
        title="Rinkodara"
        action={
          <ActionButton action={refreshMarketing} pendingLabel="Traukiu…">
            Atnaujinti
          </ActionButton>
        }
      />

      {/* ---------- Cadence ---------- */}
      <Section title="Tempas">
        <div className="grid grid-cols-3 gap-2.5">
          <Metric
            label="Per 7 d."
            value={m.postsLast7}
            hint={`buvo ${m.postsPrev7}`}
            tone={m.postsLast7 >= m.postsPrev7 ? "positive" : "warning"}
          />
          <Metric label="Instagram" value={m.counts.instagram} tone="saddle" />
          <Metric label="tjk.lt" value={m.counts.website} tone="brand" />
        </div>
      </Section>

      {/* ---------- AI-adjacent content gaps (rule-based, not model) ---------- */}
      <Section title="Ką verta padaryti">
        {m.gaps.length > 0 ? (
          <div className="space-y-2.5">
            {m.gaps.map((g) => (
              <Panel key={g.id} className="border-l-[3px] border-l-saddle-400">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <p className="text-[13.5px] font-semibold leading-snug text-ink-900">{g.title}</p>
                  <Chip tone={g.severity === "high" ? "danger" : g.severity === "medium" ? "warning" : "neutral"}>
                    {g.severity === "high" ? "svarbu" : g.severity === "medium" ? "verta" : "smulkmena"}
                  </Chip>
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-600">{g.detail}</p>
              </Panel>
            ))}
          </div>
        ) : anyData ? (
          <Empty title="Tempas geras" detail="Jokių akivaizdžių spragų nematau — skelbi reguliariai." />
        ) : (
          <Empty
            title="Dar nėra ką analizuoti"
            detail="Paspausk „Atnaujinti“ — tjk.lt įrašai užsikraus iš karto, socialiniams tinklams reikės tokenų."
          />
        )}
      </Section>

      {/* ---------- Top posts ---------- */}
      <Section title="Geriausi įrašai">
        {m.top.length > 0 ? (
          <Panel padded={false}>
            {m.top.map((p) => (
              <Row key={p.id} href={p.permalink ?? undefined}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink-900">
                    {p.caption?.slice(0, 70) || "(be teksto)"}
                  </span>
                  <span className="block text-[11px] text-ink-400">
                    {PLATFORM_LABEL[p.platform] ?? p.platform}
                    {p.mediaType ? ` · ${p.mediaType}` : ""}
                    {p.postedAt ? ` · ${formatDay(p.postedAt, tz)}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-[15px] tabular-nums text-brand-700">
                    {p.likes + p.comments}
                  </span>
                  <span className="block text-[10px] text-ink-400">reakcijų</span>
                </span>
              </Row>
            ))}
          </Panel>
        ) : (
          <Empty title="Įrašų dar nėra" />
        )}
      </Section>

      {/* ---------- Connection status ---------- */}
      <Section title="Šaltiniai">
        <Panel padded={false}>
          <Row>
            <span className="min-w-0 flex-1 text-[13px] text-ink-800">tjk.lt</span>
            <Chip tone="positive">veikia</Chip>
          </Row>
          <Row>
            <span className="min-w-0 flex-1 text-[13px] text-ink-800">Instagram</span>
            <Chip tone={m.configured.instagram ? "positive" : "neutral"}>
              {m.configured.instagram ? "prijungta" : "reikia tokeno"}
            </Chip>
          </Row>
          <Row>
            <span className="min-w-0 flex-1 text-[13px] text-ink-800">Facebook</span>
            <Chip tone={m.configured.facebook ? "positive" : "neutral"}>
              {m.configured.facebook ? "prijungta" : "reikia tokeno"}
            </Chip>
          </Row>
        </Panel>
        {(!m.configured.instagram || !m.configured.facebook) && (
          <Link
            href="/personal/nustatymai"
            className="mt-2.5 block text-center text-[11.5px] text-ink-400 underline underline-offset-4"
          >
            Prijungti socialinius tinklus
          </Link>
        )}
        {m.lastRefreshedAt && (
          <p className="mt-2 text-center text-[10.5px] text-ink-400">
            Atnaujinta {formatDay(m.lastRefreshedAt, tz)}
          </p>
        )}
      </Section>
    </>
  );
}
