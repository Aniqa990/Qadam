import type { ReactNode } from "react";

/**
 * Lightweight markdown renderer for assistant chat bubbles.
 * Supports paragraphs, bold, italic, and unordered/ordered lists —
 * enough for grounded RAG answers without adding a markdown package.
 */
export default function AssistantMessageContent({ text }: { text: string }) {
  const blocks = splitBlocks(text.trim());

  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-slate-800">
      {blocks.map((block, i) => {
        if (block.type === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-4 marker:text-emerald-600">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-4 marker:text-emerald-700">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

function splitBlocks(text: string): Block[] {
  const lines = text.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const joined = paragraph.join("\n").trim();
    if (joined) blocks.push({ type: "p", text: joined });
    paragraph = [];
  }

  function flushList() {
    if (!listType || listItems.length === 0) {
      listType = null;
      listItems = [];
      return;
    }
    blocks.push({ type: listType, items: [...listItems] });
    listType = null;
    listItems = [];
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    const ulMatch = line.match(/^[-*•]\s+(.+)$/);
    const olMatch = line.match(/^\d+[.)]\s+(.+)$/);

    if (ulMatch) {
      flushParagraph();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(ulMatch[1]);
      continue;
    }
    if (olMatch) {
      flushParagraph();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(olMatch[1]);
      continue;
    }
    if (line.trim() === "") {
      flushList();
      flushParagraph();
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }

  flushList();
  flushParagraph();
  return blocks;
}

/** Inline **bold** and *italic* (skip lone asterisks used as bullets). */
function renderInline(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(
        <em key={key++} className="italic text-slate-800">
          {token.slice(1, -1)}
        </em>
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length === 1 ? nodes[0] : nodes;
}
