"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const groups = [
  {
    title: "פרומפט",
    items: [
      { href: "/learn/my-prompts", label: "שלי", icon: "📁" },
      { href: "/learn/compose", label: "חולל", icon: "✨" },
      { href: "/learn/improve", label: "שפר", icon: "🎯" },
    ],
  },
  {
    title: "למידה",
    items: [
      { href: "/learn/insights", label: "תובנות", icon: "📊" },
      { href: "/learn", label: "Feed", icon: "📚" },
      { href: "/learn/sources", label: "ספרייה", icon: "🎬" },
      { href: "/learn/knowledge", label: "Knowledge", icon: "🧠" },
      { href: "/learn/search", label: "חיפוש", icon: "🔍" },
    ],
  },
  {
    title: "הזנה",
    items: [
      { href: "/learn/sources/new", label: "הוסף", icon: "➕" },
      { href: "/learn/sync", label: "סנכרון", icon: "🔄" },
    ],
  },
  {
    title: "ניהול",
    items: [
      { href: "/learn/tokens", label: "Tokens", icon: "💰" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-52 shrink-0 bg-slate-900/70 border-l border-slate-800 px-3 py-4 flex flex-col gap-3 sticky top-0 h-screen backdrop-blur">
      <div className="flex items-center gap-2 mb-1 px-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-black text-sm">V</div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">VEXO Learn</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">Director</div>
        </div>
      </div>
      <nav className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-thin">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1">
              {g.title}
            </div>
            <ul className="flex flex-col gap-0.5">
              {g.items.map((it) => {
                const active = pathname === it.href;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition ${
                        active
                          ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      }`}
                    >
                      <span className="text-sm">{it.icon}</span>
                      <span>{it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="text-[9px] text-slate-600 pt-2 border-t border-slate-800 px-1">
        אורן · VEXO
      </div>
    </aside>
  );
}
