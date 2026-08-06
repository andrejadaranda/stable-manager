// Home-screen icon for the command centre, generated at build time.
//
// Deliberately NOT the Longrein "L." mark: she will have both the
// Longrein app and this dashboard on the same home screen, and two
// identical icons is a daily papercut. This is an "A" monogram in the
// same locked palette (Paddock Green on Arena Cream, Saddle Tan rule) so
// it reads as a sibling, not a stranger.

import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          // Android's maskable clipping crops ~10% off each edge; the
          // monogram sits well inside that safe area.
          fontSize: 260,
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        <div style={{ display: "flex", marginTop: -28 }}>A</div>
        <div
          style={{
            display: "flex",
            width: 132,
            height: 12,
            borderRadius: 999,
            background: "#B5793E",
            marginTop: 8,
          }}
        />
      </div>
    ),
    size,
  );
}
