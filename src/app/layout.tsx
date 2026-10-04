import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pink Edge AI | Offline-first imaging triage",
  description: "Offline-first AI screening and triage support for medical imaging."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
