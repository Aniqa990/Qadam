import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, FileText, FolderOpen } from "lucide-react";
import AssistantMessageContent from "@/components/AssistantMessageContent";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

/* ─── Types ─── */

interface ChatSource {
  type?: "knowledge_chunk" | "project";
  document_id?: string;
  document_name?: string;
  file_name?: string;
  chunk_id?: string;
  chunk_index?: number;
  project_id?: string;
  project_title?: string;
  similarity?: number;
}

interface ChatResponse {
  answer: string;
  sources: ChatSource[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

/* ─── Helpers ─── */

let msgIdCounter = 0;
function nextId() {
  return `msg-${++msgIdCounter}`;
}

/** One chip per unique document / project label. */
function uniqueSources(sources: ChatSource[]): ChatSource[] {
  const seen = new Set<string>();
  const out: ChatSource[] = [];
  for (const source of sources) {
    const key =
      source.document_id ??
      source.file_name ??
      source.document_name ??
      source.project_id ??
      source.project_title ??
      JSON.stringify(source);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

function sourceLabel(source: ChatSource): string {
  const raw =
    source.document_name ?? source.file_name ?? source.project_title ?? "Source";
  if (/\.(pdf|txt|docx)$/i.test(raw)) {
    return raw
      .replace(/\.(pdf|txt|docx)$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
  }
  return raw;
}

/* ─── Component ─── */

/**
 * Global Knowledge Assistant — floating chat widget (AGENTS.md Surface 1).
 */
export default function FloatingAssistant() {
  const { api } = useApi();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const data = await api<ChatResponse>("/ai/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ message: trimmed }),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: "I'm unable to answer right now. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, api]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60]">
      {open && (
        <div className="mb-3 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border border-emerald-100/80 bg-white/90 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-emerald-100/60 bg-emerald-50/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <span className="text-sm font-semibold text-emerald-900">Qadam Assistant</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-900"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <MessageCircle className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Ask me anything about the platform, projects, or your
                  organization&apos;s knowledge base.
                </p>
              </div>
            )}

            {messages.map((msg) => {
              const sources = msg.sources ? uniqueSources(msg.sources) : [];
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-emerald-700 text-white"
                        : "border border-slate-100 bg-slate-50 text-foreground shadow-xs"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <AssistantMessageContent text={msg.content} />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {sources.length > 0 && (
                      <div className="mt-3 border-t border-slate-200/80 pt-2">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Sources
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {sources.map((source, i) => {
                            const isKnowledge =
                              source.type === "knowledge_chunk" || !!source.file_name;
                            const label = sourceLabel(source);
                            return (
                              <span
                                key={i}
                                className="inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-100"
                                title={
                                  source.file_name ??
                                  source.document_name ??
                                  source.project_title ??
                                  label
                                }
                              >
                                {isKnowledge ? (
                                  <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                                ) : (
                                  <FolderOpen className="h-3 w-3 shrink-0" aria-hidden="true" />
                                )}
                                <span className="truncate">{label}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              disabled={sending}
              className="qadam-input flex-1 py-2 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="rounded-xl bg-emerald-700 p-2.5 text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform",
          open
            ? "bg-muted text-foreground hover:bg-secondary"
            : "bg-emerald-700 text-white hover:bg-emerald-800 hover:scale-105"
        )}
        aria-label={open ? "Close assistant" : "Open assistant"}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
