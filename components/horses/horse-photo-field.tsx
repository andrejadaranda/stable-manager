"use client";

// Horse photo field for the edit dialog: a live preview + an "Upload
// from phone" button (camera or library on mobile) PLUS a manual URL
// input as fallback. The chosen/uploaded URL is carried into the form
// via a controlled input named "photo_url" so the existing server
// action picks it up unchanged.
//
// Upload flow mirrors the profile AvatarUploader: pick file →
// client-side downscale to ≤1024px JPEG → upload to the public
// `avatars` bucket under horses/<horseId>/<ts>.jpg → set the public URL.

import { useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function HorsePhotoField({
  horseId,
  initialUrl,
}: {
  horseId: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    setErrorMsg("");
    try {
      const resized = await downscaleToJpeg(file, 1024);
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      // RLS on the avatars bucket requires the FIRST path segment to be
      // the uploader's auth uid (avatars_own_insert). Nest the horse id
      // underneath so the upload passes RLS from the browser client.
      const path = `${user.id}/horses/${horseId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, resized, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setUrl(pub.publicUrl);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-neutral-700 font-medium text-sm">Photo</span>

      <div className="flex items-start gap-3">
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Horse" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-300 text-xl">🐴</div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={status === "uploading"}
            className="self-start rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-50"
          >
            {status === "uploading" ? "Uploading…" : url ? "Replace photo" : "Upload from phone"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
          <p className="text-[11px] text-neutral-500">
            Take a photo or pick from your library — we resize it automatically.
          </p>
          {status === "error" && (
            <p className="text-[11px] text-rose-700">{errorMsg}</p>
          )}
        </div>
      </div>

      {/* Manual URL fallback + the actual value submitted with the form. */}
      <input
        name="photo_url"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="…or paste an image link"
        className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
      />
    </div>
  );
}

// Downscale helper — draws onto a canvas at a max dimension and exports
// a JPEG blob. Keeps uploads small + strips EXIF. (Mirrors AvatarUploader.)
async function downscaleToJpeg(file: File, maxDim: number): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encode failed."))),
      "image/jpeg",
      0.85,
    );
  });
}
