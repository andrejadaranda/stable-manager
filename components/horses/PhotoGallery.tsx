"use client";

// Horse photo gallery — grid + upload + lightbox.

import { useState, useTransition } from "react";
import {
  uploadPhotoAction,
  deletePhotoAction,
  captionPhotoAction,
} from "@/app/dashboard/horses/[id]/photo-actions";
import type { HorsePhoto } from "@/services/horsePhotos.pure";

export function PhotoGallery({
  horseId,
  initialPhotos,
  canEdit,
}: {
  horseId: string;
  initialPhotos: HorsePhoto[];
  canEdit: boolean;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [lightbox, setLightbox] = useState<HorsePhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, startT] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr(null);
    const fd = new FormData();
    fd.set("photo", file);
    const res = await uploadPhotoAction(horseId, fd);
    if (res.error) {
      setErr(res.error);
    } else if (res.url) {
      // Optimistic — full refresh via window.location.reload would re-fetch
      // from server. For simplicity, mutate locally with a temp id.
      setPhotos((curr) => [
        { id: crypto.randomUUID(), url: res.url!, caption: null, sort_order: 0, created_at: new Date().toISOString() },
        ...curr,
      ]);
    }
    setUploading(false);
    e.target.value = "";
  }

  function onDelete(p: HorsePhoto) {
    if (!confirm("Delete this photo?")) return;
    startT(async () => {
      await deletePhotoAction(p.id, horseId);
      setPhotos((curr) => curr.filter((x) => x.id !== p.id));
      if (lightbox?.id === p.id) setLightbox(null);
    });
  }

  function onCaption(p: HorsePhoto) {
    const cap = prompt("Caption:", p.caption ?? "");
    if (cap === null) return;
    startT(async () => {
      await captionPhotoAction(p.id, horseId, cap);
      setPhotos((curr) => curr.map((x) => x.id === p.id ? { ...x, caption: cap.trim() || null } : x));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center h-10 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium cursor-pointer transition-colors">
            {uploading ? "Uploading…" : "+ Add photo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic"
              className="hidden"
              onChange={onFile}
              disabled={uploading}
            />
          </label>
          <span className="text-xs text-ink-500 tabular-nums">{photos.length} photos</span>
        </div>
      )}

      {err && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          {err}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="bg-cream-50 border border-ink-100 rounded-2xl p-8 text-center">
          <p className="text-sm font-medium text-ink-700">No photos yet.</p>
          <p className="text-xs text-ink-500 mt-1.5">
            {canEdit
              ? "Drop favourites here — first rides, championships, every-day moments."
              : "Once photos are added, they'll appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setLightbox(p)}
              className="group relative aspect-square rounded-xl overflow-hidden border border-ink-100 bg-cream-50 hover:scale-[1.02] transition-transform"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption ?? ""} className="w-full h-full object-cover" />
              {p.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs px-2.5 py-2 text-left">
                  {p.caption}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full max-h-[90vh] flex flex-col gap-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={lightbox.caption ?? ""}
              className="w-full max-h-[75vh] object-contain rounded-xl"
            />
            <div className="flex items-center gap-3 text-white">
              <p className="flex-1 text-sm">{lightbox.caption ?? <span className="text-white/50">No caption</span>}</p>
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => onCaption(lightbox)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    {lightbox.caption ? "Edit caption" : "Add caption"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(lightbox)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-200 transition-colors"
                  >
                    Delete
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
