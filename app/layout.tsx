import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "☯ 妈妈陶 ☯",
  description: "Simple shared music library powered by Supabase."
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
