import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digitale Postkarte",
  description:
    "Digitale Postkarte für Outgoing-Studierende der HTW Dresden – jetzt erstellen, als PDF generieren und einreichen.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
