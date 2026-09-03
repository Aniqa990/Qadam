import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, FileText, FolderOpen } from "lucide-react";
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

/* ─── Component ─── */

/**
 * Global Knowledge Assistant — a floating chat widget mounted once in
 * ProtectedLayout (AGENTS.md "AI Assistant Surfaces §1"). Available to
 * both authenticated roles; the server resolves caller identity and
 * serves role-appropriate answers (RAG for NGO, public data for volunteer).
 *
 * Only mounted inside ProtectedLayout, so it never appears on public
 * unauthenticated routes (landing, login, register).
 */
export default function FloatingAssistant() {
  const { api } = useApi();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Auto-scroll to bottom on new messages */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  /* Focus input when panel opens */
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  /* ─── Send message ─── */

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
      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: "assistant",
        content: data.answer,
        sources: data.sources,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: nextId(),
        role: "assistant",
        content: "I'm unable to answer right now. Please try again.",
      };
      setMessages((prev) => [...prev, errorMsg]);
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

  /* ─── Render ─── */

  return (
    <div className="fixed bottom-4 right-4 z-[60]">
      {/* Chat panel */}
      {open && (
        <div className="mb-3 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          {/* Panel header */}
          <div className="flex items-center justify-between bg-emerald-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-white" aria-hidden="true" />
              <span className="text-sm font-semibold text-white">
                Qadam Assistant
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-emerald-200 hover:bg-emerald-600 hover:text-white"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <MessageCircle
                  className="h-10 w-10 text-muted-foreground/40"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm text-muted-foreground">
                  Ask me anything about the platform, projects, or your
                  organization's knowledge base.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-emerald-700 text-white"
                      : "bg-muted text-foreground"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-border/50 pt-2">
                      {msg.sources.map((source, i) => {
                        const isKnowledge =
                          source.type === "knowledge_chunk" || !!source.file_name;
                        const label =
                          source.document_name ??
                          source.file_name ??
                          source.project_title ??
                          "Source";
                        return (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700"
                            title={isKnowledge ? `From: ${label}` : `Project: ${label}`}
                          >
                            {isKnowledge ? (
                              <FileText className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <FolderOpen className="h-3 w-3" aria-hidden="true" />
                            )}
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t px-3 py-2.5">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              disabled={sending}
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="rounded-md bg-emerald-700 p-2 text-white hover:bg-emerald-800 disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
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
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}
