"use client";

// Profile photo direct uploader.
//
// Flow:
//   1. User taps "Upload photo" → native file picker (iOS: camera roll
//      or take new photo; macOS: file chooser)
//   2. We resize client-side to max 512×512 webp ≤200 KB
//      (Supabase Storage charges per byte; phone JPGs are huge)
//   3. PUT to Supabase Storage `avatars/<auth_user_id>/<random>.webp`
//   4. Get public URL → update the form's hidden photo_url field
//   5. Preview the new avatar inline + flag "Save changes" so the
//      user knows they still have to commit
//
// Why client-side resize: phone camera JPGs are 3-6 MB. Uploading
// raw + resizing on the server = slow + double-bandwidth + needs a
// route handler. Doing it in the browser via canvas is one library-
// free function (~40 LOC), instant feedback, and respects the user's
// data plan.

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  /** Initial photo URL (from profiles.photo_url). */
  initialUrl: string | null;
  /** The avatar fallback (single letter) when nothing's set. */
  initial: string;
  /** Field name the parent form reads on submit. */
  fieldName?: string;
};

const MAX_DIMENSION = 512;
const TARGET_TYPE   = "image/webp";
const TARGET_QUALITY = 0.85;

export function AvatarUploader({
  initialUrl,
  initial,
  fieldName = "photo_url",
}: Props) {
  const [url, setUrl]         = useState<string | null>(initialUrl);
  const [status, setStatus]   = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError]     = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Local preview gets a stale-cache buster so the new avatar shows
  // even if the public URL hasn't propagated through Supabase's CDN.
  const [bust, setBust] = useState(0);
  const displayUrl = url ? `${url}${url.includes("?") ? "&" : "?"}v=${bust}` : null;

  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setStatus("uploading");

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("That doesn't look like an image. Pick a JPG, PNG, or HEIC.");
      }
      // 8 MB hard ceiling before we even try to resize — Safari can
      // OOM on huge images during canvas decode.
      if (file.size > 8 * 1024 * 1024) {
        throw new Error("Image is too big. Pick something under 8 MB.");
      }

      const resized = await downsizeImage(file);
      const supabase = createSupabaseBrowserClient();
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error("Not signed in.");

      // Random filename so replace doesn't have to delete first +
      // CDN never serves a stale image.
      const ext  = "webp";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, resized, {
          contentType: TARGET_TYPE,
          cacheControl: "31536000",  // 1y — random filename means safe to cache forever
          upsert: false,
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setUrl(pub.publicUrl);
      setBust((n) => n + 1);
      setStatus("idle");
    } catch (err: any) {
      setError(err?.message ?? "Upload failed.");
      setStatus("error");
    } finally {
      // Clear the input so picking the same file twice re-fires onChange.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onRemove() {
    setUrl(null);
    setError(null);
    setBust((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Hidden field that the parent <form> serialises on submit. */}
      <input type="hidden" name={fieldName} value={url ?? ""} />

      <div className="flex items-center gap-4">
        {/* Avatar preview */}
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
            alt="Profile photo"
            className="w-20 h-20 rounded-2xl object-cover ring-2 ring-white shadow-soft"
          />
        ) : (
          <span
            aria-hidden
            className="w-20 h-20 rounded-2xl shrink-0 inline-flex items-center justify-center bg-brand-500 text-white font-semibold text-2xl shadow-soft"
          >
            {initial}
          </span>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={status === "uploading"}
              className="rounded-md bg-neutral-900 text-white px-3.5 py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "uploading"
                ? "Uploading…"
                : url
                ? "Replace photo"
                : "Upload photo"}
            </button>
            {url && (
              <button
                type="button"
                onClick={onRemove}
                disabled={status === "uploading"}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-[11.5px] text-ink-500 leading-relaxed">
            Phone camera works — JPG, PNG, HEIC.<br />
            We resize automatically so uploads stay quick.
          </p>
        </div>
      </div>

      {/* Native file picker — iOS Safari will offer camera + photo
          library inline thanks to `accept` and `capture`. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        // The camera attribute is intentionally omitted (no `capture`)
        // so iOS shows the FULL picker (Take photo / Choose photo /
        // Browse) instead of jumping straight into camera.
        onChange={onPick}
        className="hidden"
      />

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Resize helper — decodes the file via createImageBitmap (handles
// HEIC on iOS Safari + EXIF orientation automatically), draws to a
// canvas capped at MAX_DIMENSION on the longer side, encodes as webp.
// ----------------------------------------------------------------
async function downsizeImage(file: File): Promise<Blob> {
  // createImageBitmap with imageOrientation:"from-image" honours EXIF
  // so portrait phone shots don't end up sideways.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  } as any);

  let { width, height } = bitmap;
  if (width === 0 || height === 0) {
    throw new Error("Couldn't read that image. Try another file.");
  }
  if (Math.max(width, height) > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width  = Math.round(width  * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser doesn't support canvas 2D.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, TARGET_TYPE, TARGET_QUALITY),
  );
  if (!blob) throw new Error("Couldn't encode the image. Try another one.");
  return blob;
}
