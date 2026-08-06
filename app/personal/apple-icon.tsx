// iOS home-screen icon. Same monogram as icon.tsx at Apple's 180×180.
//
// iOS does NOT apply a mask to apple-touch-icons the way Android does —
// it rounds the corners itself — so this variant fills the square edge
// to edge with no extra safe-area inset.

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#1E3A2A",
          color: "#F8F4EE",
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        <div style={{ display: "flex", marginTop: -10 }}>A</div>
        <div
          style={{
            display: "flex",
            width: 48,
            height: 5,
            borderRadius: 999,
            background: "#B5793E",
            marginTop: 3,
          }}
        />
      </div>
    ),
    size,
  );
}
