"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { adminHeaders } from "@/lib/admin-key";

type Message = { id: string; role: "user" | "brain"; content: string; createdAt?: string };

type ParsedAction = { action: any; raw: string };
function parseAction(text: string): { stripped: string; action: ParsedAction | null } {
  const re = /```action\s*([\s\S]*?)```/;
  const m = text.match(re);
  if (!m) return { stripped: text, action: null };
  try {
    const action = JSON.parse(m[1].trim());
    return { stripped: text.replace(re, "").trim(), action: { action, raw: m[1].trim() } };
  } catch {
    return { stripped: text, action: null };
  }
}

function actionLabel(action: any): string {
  switch (action.type) {
    case "import_guide_url": return `📥 ייבא מדריך מ-URL`;
    case "ai_guide": return `🤖 צור מדריך AI`;
    case "import_instagram_guide": return `📷 ייבא פוסט Instagram כמדריך`;
    case "import_source": return `➕ צור מקור פרומפט חדש`;
    default: return `⚡ ${action.type}`;
  }
}

function actionDetail(action: any): string {
  if (action.url) return action.url;
  if (action.topic) return `"${action.topic}"`;
  return "";
}

export default function BrainChatUI({ initialChatId }: { initialChatId?: string }) {
  const [chatId, setChatId] = useState<string | undefined>(initialChatId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [executed, setExecuted] = useState<Record<string, { text: string; url: string | null }>>({});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatId) return;
    fetch(`/api/brain/chats/${chatId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.chat?.messages) setMessages(d.chat.messages);
      });
  }, [chatId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function executeAction(messageId: string, action: any) {
    setExecutingId(messageId);
    setError(null);
    try {
      const res = await fetch("/api/brain/chat/execute", {
        method: "POST",
        headers: adminHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ action, chatId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setExecuted((e) => ({ ...e, [messageId]: { text: data.text || "✅ בוצע", url: data.url || null } }));
      if (data.text) {
        setMessages((m) => [...m, { id: `exec-${Date.now()}`, role: "brain", content: `${data.text}${data.url ? `\n🔗 ${data.url}` : ""}` }]);
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setExecutingId(null);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setLoading(true);
    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: "user", content: text }]);
    setInput("");
    try {
      const res = await fetch("/api/brain/chat", {
        method: "POST",
        headers: adminHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ chatId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!chatId) setChatId(data.chatId);
      setMessages((m) => [...m, { id: data.messageId, role: "brain", content: data.reply }]);
    } catch (e: any) {
      setError(String(e?.message || e));
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-xs text-slate-400">
          {chatId ? `שיחה: ${chatId.slice(-8)}` : "שיחה חדשה"}
        </div>
        <div className="flex gap-2">
          <Link
            href="/learn/brain/chat/logs"
            className="text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 px-3 py-1.5 rounded"
          >
            📂 לוגי שיחות
          </Link>
          {chatId && (
            <button
              onClick={() => {
                setChatId(undefined);
                setMessages([]);
              }}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded"
            >
              ✨ שיחה חדשה
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm text-slate-500 py-8">
            דבר עם המוח. שאל שאלה, תן משוב, או הצע כיוון.
          </div>
        )}
        {messages.map((m) => {
          const { stripped, action } = m.role === "brain" ? parseAction(m.content) : { stripped: m.content, action: null };
          const done = executed[m.id];
          return (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-50"
                    : "bg-purple-500/10 border border-purple-500/30 text-slate-100"
                }`}
              >
                <div className="text-[10px] uppercase mb-1 opacity-60">
                  {m.role === "user" ? "את/ה" : "🧠 המוח"}
                </div>
                {stripped}
                {action && !done && (
                  <div className="mt-3 bg-slate-950/60 border border-amber-500/40 rounded-xl p-3">
                    <div className="text-xs font-semibold text-amber-300 mb-1">{actionLabel(action.action)}</div>
                    <div className="text-[11px] text-slate-400 mb-2 break-all">{actionDetail(action.action)}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => executeAction(m.id, action.action)}
                        disabled={executingId === m.id}
                        className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs px-3 py-1.5 rounded"
                      >
                        {executingId === m.id ? "⏳ מבצע..." : "✅ אשר ובצע"}
                      </button>
                      <button
                        onClick={() => setExecuted((e) => ({ ...e, [m.id]: { text: "בוטל", url: null } }))}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs px-3 py-1.5 rounded"
                      >
                        ❌ ביטול
                      </button>
                    </div>
                  </div>
                )}
                {done && (
                  <div className="mt-3 bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-3 text-xs">
                    <div className="text-emerald-300 font-semibold">{done.text}</div>
                    {done.url && (
                      <a href={done.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline mt-1 inline-block">
                        פתח ←
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-purple-500/10 border border-purple-500/30 px-4 py-2.5 rounded-2xl text-sm text-slate-400">
              🧠 חושב...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="כתוב למוח... (Enter לשליחה, Shift+Enter לשורה חדשה)"
          rows={2}
          className="flex-1 bg-slate-900 border border-slate-700 focus:border-cyan-500/60 rounded-xl px-4 py-3 text-sm text-slate-100 resize-none outline-none"
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold px-5 rounded-xl text-sm"
        >
          שלח
        </button>
      </div>
    </div>
  );
}
