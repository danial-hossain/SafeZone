import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeZone — Safety, with you in control",
  description: "A personal and community safety assistant. AI guidance supports your judgment; emergency services remain the right choice in immediate danger.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
