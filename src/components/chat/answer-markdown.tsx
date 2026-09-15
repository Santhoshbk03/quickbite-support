"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Retrieval } from "@/lib/api";
import { CitationChip } from "./citation-chip";

const CITE_PREFIX = "#cite-";

/**
 * Turn `[n]` markers into links react-markdown can hand to a component, and smooth over the
 * half-arrived syntax a stream produces between frames.
 */
function prepareMarkdown(text: string, citable: ReadonlySet<number>, streaming: boolean): string {
  let output = text;
  if (streaming) {
    // A marker split across deltas ("…within 2 hours [1") would flash as literal text.
    output = output.replace(/\[\d{0,2}$/, "");
    // An unclosed bold run would render its asterisks until the closing pair arrives.
    if ((output.match(/\*\*/g)?.length ?? 0) % 2 === 1) output += "**";
  }
  // Only ranks that cleared the threshold are citable; anything else stays literal, per the contract.
  return output.replace(/\[(\d{1,2})\](?!\()/g, (match, digits: string) =>
    citable.has(Number(digits)) ? `[${digits}](${CITE_PREFIX}${digits})` : match,
  );
}

export const AnswerMarkdown = memo(function AnswerMarkdown({
  text,
  retrieval,
  turnId,
  streaming,
}: {
  text: string;
  retrieval: Retrieval | null;
  turnId: string;
  streaming: boolean;
}) {
  const chunks = retrieval?.chunks ?? [];
  const citable = new Set(
    chunks.filter((chunk) => chunk.passed_threshold).map((chunk) => chunk.rank),
  );

  const components: Components = {
    a: ({ href, children, title }) => {
      if (href?.startsWith(CITE_PREFIX)) {
        const rank = Number(href.slice(CITE_PREFIX.length));
        const chunk = chunks.find((candidate) => candidate.rank === rank);
        return chunk ? <CitationChip chunk={chunk} turnId={turnId} /> : <span>[{rank}]</span>;
      }
      const external = href?.startsWith("http");
      return (
        <a
          href={href}
          title={title}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer noopener" : undefined}
        >
          {children}
        </a>
      );
    },
    table: ({ children }) => (
      <div className="scrollbar-thin overflow-x-auto rounded-md border border-line">
        <table>{children}</table>
      </div>
    ),
  };

  return (
    <div className="prose-answer">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {prepareMarkdown(text, citable, streaming)}
      </ReactMarkdown>
    </div>
  );
});
