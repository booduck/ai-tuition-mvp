import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tuition with AI",
  description: "BM-first voice tutor (Tahun 3 & Tahun 6)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ms">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body>{children}</body>
    </html>
  );
}
