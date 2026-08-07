"use client";

// The composer: write once, publish to several platforms.
//
// Media goes straight from the phone to Supabase Storage rather than
// through a server action. Server actions serialise their payload into
// the RSC request, and a 20 MB video encoded that way would blow past
// the body limit and hold a lambda open for the whole upload. The
// browser client uploads directly; only the resulting public URL is sent
// to the server.
//
// That upload path is also why the bucket is public-read: Meta's
// publishing API fetches `image_url` from its own servers with no
// credentials, so a signed URL would not work.

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/personal/ui";
import {
  savePostAction,
  publishNowAction,
  generateCaptionAction,
} from "@/app/personal/social-actions";

type PlatformKey = "instagram_feed" | "instagram_story" | "facebook_page";
type Media = { url: string; type: "image" | "video" };

const PLATFORMS: Array<{ key: PlatformKey; label: string; note: string }> = [
  { key: "instagram_feed", label: "Instagram", note: "1:1 arba 4:5" },
  { key: "instagram_story", label: "Story", note: "9:16 · be teksto" },
  { key: "facebook_page", label: "Facebook", note: "galima ir be nuotraukos" },
];

const MAX_BYTES = 100 * 1024 * 1024;

export function Composer({
  connected,
}: {
  connected: Record<PlatformKey, boolean>;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [platforms, setPlatforms] = useState<PlatformKey[]>(
    connected.instagram_feed ? ["instagram_feed"] : [],
  );
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiBrief, setAiBrief] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [pending, start] = useTransition();

  const needsMedia = platforms.some((p) => p.startsWith("instagram"));
  const anyConnected = Object.values(connected).some(Boolean);

  // Instagram counts characters against 2200; Facebook is effectively
  // unlimited. Showing the tighter of the selected limits is what stops a
  // caption being silently truncated on publish.
  const limit = useMemo(
    () => (platforms.some((p) => p.startsWith("instagram")) ? 2200 : 63206),
    [platforms],
  );

  function toggle(key: PlatformKey) {
    setPlatforms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFeedback(null);
    setUploading(true);
    try {
      if (file.size > MAX_BYTES) {
        throw new Error("Failas per didelis (daugiau nei 100 MB).");
      }

      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error("Neprisijungta.");

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      // Folder named after the user id — the storage policy in migration
      // 112 requires it.
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("personal-social")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("personal-social").getPublicUrl(path);
      setMedia((prev) => [
        ...prev,
        { url: pub.publicUrl, type: file.type.startsWith("video") ? "video" : "image" },
      ]);
    } catch (err: any) {
      setFeedback({ ok: false, text: err?.message ?? "Nepavyko įkelti." });
    } finally {
      setUploading(false);
      // Clear so picking the same file twice re-fires onChange.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit(mode: "draft" | "schedule" | "now") {
    start(async () => {
      setFeedback(null);

      const result = await savePostAction({
        platforms,
        content,
        media,
        scheduledFor: mode === "schedule" ? toIso(scheduledFor) : null,
      });

      if (!result.ok) {
        setFeedback({ ok: false, text: result.error });
        return;
      }

      if (mode === "now" && result.id) {
        const published = await publishNowAction(result.id);
        setFeedback(
          published.ok
            ? { ok: true, text: "Paskelbta." }
            : { ok: false, text: published.error },
        );
        if (published.ok) reset();
        router.refresh();
        return;
      }

      setFeedback({
        ok: true,
        text: mode === "schedule" ? "Suplanuota." : "Išsaugota juodraščiuose.",
      });
      reset();
      router.refresh();
    });
  }

  function reset() {
    setContent("");
    setMedia([]);
    setScheduledFor("");
    setAiBrief("");
    setAiOpen(false);
  }

  function generate() {
    start(async () => {
      setFeedback(null);
      const result = await generateCaptionAction(aiBrief);
      if (result.ok) {
        setContent(result.text);
        setAiOpen(false);
      } else {
        setFeedback({ ok: false, text: result.error });
      }
    });
  }

  if (!anyConnected) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-surface-muted/40 px-5 py-7 text-center">
        <p className="text-[13px] font-medium text-ink-700">Nė viena paskyra neprijungta</p>
        <p className="mx-auto mt-1.5 max-w-[34ch] text-[12px] leading-relaxed text-ink-500">
          Kad galėtum skelbti, prijunk Instagram ir Facebook nustatymuose. Ten
          yra mygtukas, kuris tokeną susitvarko už tave.
        </p>
        <a
          href="/personal/nustatymai"
          className="mt-3 inline-block rounded-full bg-brand-600 px-4 py-2 text-[12.5px] font-semibold text-white"
        >
          Prijungti paskyras
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink-200/70 bg-white/70 p-4 shadow-soft">
      {/* ---- platforms ---- */}
      <div className="mb-3 flex flex-wrap gap-2">
        {PLATFORMS.map((p) => {
          const on = platforms.includes(p.key);
          const available = connected[p.key];
          return (
            <button
              key={p.key}
              type="button"
              disabled={!available}
              onClick={() => toggle(p.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                on
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-ink-200 bg-white text-ink-600",
                !available && "cursor-not-allowed opacity-40",
              )}
              title={available ? p.note : "Neprijungta"}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ---- text ---- */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={6}
        placeholder="Ką norim papasakoti?"
        // 16px minimum — anything smaller makes iOS Safari zoom on focus
        // and the layout never fully recovers.
        className="w-full resize-y rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-[16px] leading-relaxed text-ink-900 outline-none focus:border-brand-400 focus:shadow-focus"
      />
      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setAiOpen((v) => !v)}
          className="text-[11.5px] font-medium text-brand-700 underline underline-offset-4"
        >
          {aiOpen ? "Slėpti" : "Parašyk už mane"}
        </button>
        <span
          className={cn(
            "text-[11px] tabular-nums",
            content.length > limit ? "text-rose-600" : "text-ink-400",
          )}
        >
          {content.length}/{limit}
        </span>
      </div>

      {aiOpen && (
        <div className="mt-2 rounded-xl bg-surface-muted/70 p-3">
          <input
            value={aiBrief}
            onChange={(e) => setAiBrief(e.target.value)}
            placeholder="pvz. rytinė treniruotė rūke, Justė su Zefyru"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-[16px] text-ink-900 outline-none focus:border-brand-400"
          />
          <button
            type="button"
            disabled={pending}
            onClick={generate}
            className="mt-2 rounded-full bg-brand-600 px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Rašau…" : "Sugeneruoti"}
          </button>
        </div>
      )}

      {/* ---- media ---- */}
      <div className="mt-3">
        {media.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {media.map((m, i) => (
              <div key={m.url} className="relative">
                {m.type === "video" ? (
                  <video src={m.url} className="h-20 w-20 rounded-lg object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => setMedia((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Pašalinti"
                  className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-ink-900 text-[11px] font-bold text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          onChange={onPickFile}
          className="hidden"
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink-700 disabled:opacity-50"
        >
          {uploading ? "Keliu…" : media.length ? "Pridėti dar" : "Pridėti nuotrauką"}
        </button>
        {needsMedia && media.length === 0 && (
          <span className="ml-2 text-[11px] text-amber-700">Instagram be nuotraukos negali</span>
        )}
      </div>

      {/* ---- schedule ---- */}
      <div className="mt-3">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-ink-600">
            Suplanuoti (nebūtina)
          </span>
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-[16px] text-ink-900 outline-none focus:border-brand-400"
          />
        </label>
      </div>

      {/* ---- actions ---- */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || uploading}
          onClick={() => submit(scheduledFor ? "schedule" : "now")}
          className="rounded-full bg-brand-600 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50 active:bg-brand-700"
        >
          {pending ? "Palauk…" : scheduledFor ? "Suplanuoti" : "Skelbti dabar"}
        </button>
        <button
          type="button"
          disabled={pending || uploading}
          onClick={() => submit("draft")}
          className="rounded-full border border-ink-200 bg-white px-4 py-2 text-[12.5px] font-semibold text-ink-700 disabled:opacity-50"
        >
          Į juodraščius
        </button>
        {feedback && (
          <Chip tone={feedback.ok ? "positive" : "danger"}>{feedback.text}</Chip>
        )}
      </div>
    </div>
  );
}

/**
 * `datetime-local` gives a wall-clock string with no zone. Constructing a
 * Date from it uses the DEVICE's timezone — which is what she means when
 * she picks 09:00 on her phone in Vilnius.
 */
function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
