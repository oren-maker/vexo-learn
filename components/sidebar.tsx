"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const groups = [
  {
    title: "הפרומפט המושלם",
    items: [
      { href: "/learn/my-prompts", label: "הפרומפטים שלי", icon: "📁" },
      { href: "/learn/compose", label: "חולל פרומפט", icon: "✨" },
      { href: "/learn/improve", label: "שפר פרומפט", icon: "🎯" },
    ],
  },
  {
    title: "מקורות למידה",
    items: [
      { href: "/learn/insights", label: "תובנות מהמאגר", icon: "📊" },
      { href: "/learn", label: "Feed", icon: "📚" },
      { href: "/learn/sources", label: "ספריית פרומפטים", icon: "🎬" },
      { href: "/learn/knowledge", label: "Knowledge Base", icon: "🧠" },
      { href: "/learn/search", label: "חיפוש וידאו", icon: "🔍" },
    ],
  },
  {
    title: "הזנת חומר",
    items: [
      { href: "/learn/sources/new", label: "הוסף URL/קובץ", icon: "➕" },
      { href: "/learn/sync", label: "סנכרון ויבוא", icon: "🔄" },
    ],
  },
  {
    title: "ניהול",
    items: [
      { href: "/learn/tokens", label: "עלויות ו-Tokens", icon: "💰" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 bg-slate-900/70 border-l border-slate-800 p-5 flex flex-col gap-6 sticky top-0 h-screen backdrop-blur">
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-black">V</div>
          <div>
            <div className="text-base font-bold text-white leading-tight">VEXO Learn</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Director Training</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 flex flex-col gap-5">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {g.title}
            </div>
            <ul className="flex flex-col gap-1">
              {g.items.map((it) => {
                const active = pathname === it.href;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                        active
                          ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      }`}
                    >
                      <span>{it.icon}</span>
                      <span>{it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="text-[11px] text-slate-600 pt-4 border-t border-slate-800">
        אורן · VEXO Studio
      </div>
    </aside>
  );
}
