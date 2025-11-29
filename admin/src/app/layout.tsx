import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digitale Postkarte – Admin",
  description:
    "Verwaltung der digitalen Postkarten für autorisierte Mitarbeitende der HTW Dresden.",
  robots: {
    index: false,
    follow: false,
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
