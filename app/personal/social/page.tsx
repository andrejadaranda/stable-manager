// Screen 7 — Socialiniai tinklai. Compose, schedule, and see what went out.
//
// This is the write side. The Marketing screen (/personal/marketing) is
// the read side — what performed well after the fact. They are separate
// screens because they answer different questions at different moments:
// "what should I post" in the morning, "did it work" later.

import Link from "next/link";
import { listPosts, getPublishTargets, PLATFORMS } from "@/services/personalDashboard/social";
import { getStableTimeZone } from "@/services/personalDashboard/common";
import { ScreenHeader, Section, Panel, Chip, Empty, formatDay, formatTime } from "@/components/personal/ui";
import { Composer } from "@/components/personal/composer";
import { PostRow } from "@/components/personal/post-row";

export const dynamic = "force-dynamic";
export const metadata = { title: "Socialiniai tinklai" };

export default async function SocialScreen() {
  const [posts, connected, tz] = await Promise.all([
    listPosts(40),
    getPublishTargets(),
    getStableTimeZone(),
  ]);

  const scheduled = posts.filter((p) => p.status === "scheduled" || p.status === "publishing");
  const drafts = posts.filter((p) => p.status === "draft");
  const done = posts.filter((p) =>
    ["published", "partial", "failed"].includes(p.status),
  );

  const connectedCount = Object.values(connected).filter(Boolean).length;

  return (
    <>
      <ScreenHeader
        eyebrow="TJK"
        title="Skelbimai"
        action={
          <Chip tone={connectedCount > 0 ? "positive" : "neutral"}>
            {connectedCount}/{PLATFORMS.length} prijungta
          </Chip>
        }
      />

      <Section title="Naujas įrašas">
        <Composer connected={connected} />
      </Section>

      {scheduled.length > 0 && (
        <Section title="Suplanuota" hint={`${scheduled.length}`}>
          <Panel padded={false}>
            {scheduled.map((p) => (
              <PostRow
                key={p.id}
                post={p}
                when={
                  p.scheduledFor
                    ? `${formatDay(p.scheduledFor, tz)} ${formatTime(p.scheduledFor, tz)}`
                    : null
                }
              />
            ))}
          </Panel>
        </Section>
      )}

      {drafts.length > 0 && (
        <Section title="Juodraščiai" hint={`${drafts.length}`}>
          <Panel padded={false}>
            {drafts.map((p) => (
              <PostRow key={p.id} post={p} when={null} />
            ))}
          </Panel>
        </Section>
      )}

      <Section title="Paskelbta">
        {done.length > 0 ? (
          <Panel padded={false}>
            {done.map((p) => (
              <PostRow
                key={p.id}
                post={p}
                when={
                  p.publishedAt
                    ? `${formatDay(p.publishedAt, tz)} ${formatTime(p.publishedAt, tz)}`
                    : null
                }
              />
            ))}
          </Panel>
        ) : (
          <Empty
            title="Dar nieko nepaskelbta"
            detail="Kai paskelbsi pirmą įrašą, jis atsiras čia kartu su rezultatais."
          />
        )}
      </Section>

      <p className="mb-2 px-1 text-center text-[10.5px] leading-relaxed text-ink-400">
        Suplanuoti įrašai išsiunčiami maždaug kas 5 minutes. Kaip sekėsi —
        skaičiai atsiranda{" "}
        <Link href="/personal/marketing" className="underline underline-offset-2">
          Rinkodaros
        </Link>{" "}
        ekrane, kai paspaudi „Atnaujinti“.
      </p>
    </>
  );
}
