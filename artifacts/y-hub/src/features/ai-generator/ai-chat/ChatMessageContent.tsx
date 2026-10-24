import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { messageDirection, normalizeMathDelimiters } from "./mathMarkdown";
import "./chatMath.css";
export { normalizeMathDelimiters } from "./mathMarkdown";

interface ChatMessageContentProps {
  content: string;
}

export function ChatMessageContent({
  content,
}: ChatMessageContentProps) {
  return (
    <div
      dir={messageDirection(content)}
      className={[
        "ai-tutor-message prose prose-sm dark:prose-invert",
        "max-w-none min-w-0 break-words",
        "[&_.katex-display]:max-w-full",
        "[&_.katex-display]:overflow-x-auto",
        "[&_.katex-display]:overflow-y-hidden",
        "[&_pre]:max-w-full",
        "[&_pre]:overflow-x-auto",
      ].join(" ")}
    >
      <ReactMarkdown
        components={{
          img: () => null,
          a: ({ children }) => <span>{children}</span>,
        }}
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, {
          strict: "ignore",
          trust: false,
          throwOnError: false,
          maxExpand: 1000,
        }]]}
      >
        {normalizeMathDelimiters(content)}
      </ReactMarkdown>
    </div>
  );
}
