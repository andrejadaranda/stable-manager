import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stable OS — modern stable management",
  description:
    "Schedule lessons, track payments, and protect your horses. Built for European riding stables.",
  applicationName: "Stable OS",
  themeColor: "#FAF8F5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
