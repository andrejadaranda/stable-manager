// Dynamic 512x512 app icon. Rendered server-side via @vercel/og at
// build time, cached aggressively. The Stable.OS mark = an orange
// stable-house silhouette on a navy ground — readable at 32px, dramatic
// at 512px.

import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width:          "100%",
          height:         "100%",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          background:     "linear-gradient(135deg, #1E2A47 0%, #0E1729 100%)",
        }}
      >
        <svg width="320" height="320" viewBox="0 0 24 24" fill="none">
          {/* Stable house silhouette — same shape used in the auth
              header so the brand mark stays consistent. */}
          <path
            d="M5 18V8.5l5-3.5 5 3.5V18M9 18v-4h2v4"
            stroke="#F4663D"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}
