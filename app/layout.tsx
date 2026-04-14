import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import Sidebar from "@/components/sidebar";
import "./globals.css";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo" });

export const metadata: Metadata = {
  title: "VEXO Learn",
  description: "ניתוח וידאו והזנת AI Director",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-sans antialiased min-h-screen bg-slate-950 text-slate-100`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6 md:p-10 overflow-x-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
