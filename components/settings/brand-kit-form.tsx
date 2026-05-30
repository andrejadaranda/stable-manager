"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  saveBrandColorAction,
  uploadLogoAction,
  removeLogoAction,
  type BrandState,
} from "@/app/dashboard/settings/brand/actions";

const PRESETS = [
  { name: "Paddock", hex: "#1E3A2A" },
  { name: "Saddle",  hex: "#B5793E" },
  { name: "Forest",  hex: "#2D5A3D" },
  { name: "Navy",    hex: "#1B2D4A" },
  { name: "Wine",    hex: "#7A1F2B" },
  { name: "Coal",    hex: "#1B1B1B" },
  { name: "Sky",     hex: "#2C6BB5" },
  { name: "Plum",    hex: "#6B2C7A" },
];

const initial: BrandState = { error: null, success: false };

export function BrandKitForm({
  initialColor,
  initialLogoUrl,
  stableName,
}: {
  initialColor: string;
  initialLogoUrl: string | null;
  stableName: string;
}) {
  const [color, setColor] = useState(initialColor);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [removing, startRemoving] = useTransition();
  const [colorState, colorAction] = useFormState(saveBrandColorAction, initial);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr(null);
    const fd = new FormData();
    fd.set("logo", file);
    const res = await uploadLogoAction(fd);
    if (res.error) {
      setUploadErr(res.error);
    } else {
      setLogoUrl(res.url);
    }
    e.target.value = "";
  }

  function handleRemove() {
    startRemoving(async () => {
      await removeLogoAction();
      setLogoUrl(null);
    });
  }

  return (
    <div className="space-y-8">
      {/* Live preview */}
      <section className="rounded-2xl border border-ink-100 overflow-hidden shadow-soft">
        <div
          className="px-5 py-3 flex items-center gap-3 text-white"
          style={{ backgroundColor: color }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-full object-cover bg-white/10" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center font-display text-base">
              {stableName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="font-display text-lg leading-none">{stableName}</div>
          <span className="ml-auto text-xs uppercase tracking-wider opacity-80 font-semibold">Preview</span>
        </div>
        <div className="px-5 py-4 bg-cream-50 text-sm text-ink-700">
          <strong>Live preview</strong> — this is how your clients will see your brand in invitation emails and the app header.
        </div>
      </section>

      {/* Logo upload */}
      <section className="space-y-3">
        <h3 className="font-display text-base text-navy-700">Logo</h3>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl border border-ink-100 bg-cream-50 flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Current logo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-ink-400 text-xs">No logo</span>
            )}
          </div>
          <div className="flex-1">
            <label className="inline-flex items-center h-10 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium cursor-pointer transition-colors">
              {logoUrl ? "Replace logo" : "Upload logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleFile}
              />
            </label>
            {logoUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="ml-2 h-10 px-3 rounded-xl border border-ink-200 text-sm text-ink-700 hover:bg-ink-50 transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            )}
            <p className="text-xs text-ink-500 mt-2">PNG, JPG, WebP, or SVG. Max 2 MB. Square works best.</p>
            {uploadErr && <p className="text-xs text-red-700 mt-1">{uploadErr}</p>}
          </div>
        </div>
      </section>

      {/* Color picker */}
      <section className="space-y-3">
        <h3 className="font-display text-base text-navy-700">Brand color</h3>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.hex}
              type="button"
              onClick={() => setColor(p.hex)}
              className={`h-12 w-full rounded-xl border-2 transition-all ${
                color.toLowerCase() === p.hex.toLowerCase()
                  ? "border-ink-900 scale-105 shadow-md"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: p.hex }}
              title={p.name}
            />
          ))}
        </div>
        <form action={colorAction} className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-12 rounded-lg border border-ink-200 cursor-pointer"
            />
            <input
              type="text"
              name="brand_color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              pattern="^#[0-9a-fA-F]{6}$"
              maxLength={7}
              className="h-10 px-3 rounded-lg border border-ink-200 text-sm font-mono w-32"
            />
          </label>
          <ColorSaveButton />
          {colorState.success && <span className="text-sm text-emerald-700">✓ Saved</span>}
          {colorState.error   && <span className="text-sm text-red-700">{colorState.error}</span>}
        </form>
      </section>
    </div>
  );
}

function ColorSaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save color"}
    </button>
  );
}
