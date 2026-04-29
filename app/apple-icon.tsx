// Apple touch icon — what shows on the iPhone home screen when the
// user picks Share → Add to Home Screen. iOS rounds it to a squircle
// automatically, so we don't pre-round; we just paint edge-to-edge.

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
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
