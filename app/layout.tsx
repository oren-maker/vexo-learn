import type { Metadata } from "next";
import { headers } from "next/headers";
import { Heebo } from "next/font/google";
import Sidebar from "@/components/sidebar";
import "./globals.css";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo" });

export const metadata: Metadata = {
  title: "VEXO Learn",
  description: "ניתוח וידאו והזנת AI Director",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isEmbed = headers().get("x-embed") === "1";

  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-sans antialiased min-h-screen bg-slate-950 text-slate-100`}>
        <div className="flex min-h-screen">
          {!isEmbed && <Sidebar />}
          <main className={`flex-1 ${isEmbed ? "p-4" : "p-6 md:p-10"} overflow-x-hidden`}>{children}</main>
        </div>
      </body>
    </html>
  );
}
