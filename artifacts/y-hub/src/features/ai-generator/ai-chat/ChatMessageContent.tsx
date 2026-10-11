import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * Convert Groq's LaTeX delimiters to remark-math syntax.
 * Preserve literal delimiters inside fenced and inline code.
 */
export function normalizeMathDelimiters(
  content: string
): string {
  const sections = content.split(
    /(```[\s\S]*?```|~~~[\s\S]*?~~~|`+[^`\n]*`+)/g
  );

  return sections.map((section, index) => {
    if (index % 2 === 1) {
      return section;
    }

    return section
      .replace(
        /\\\[([\s\S]*?)\\\]/g,
        (_, expression: string) =>
          '\n\n$$\n' + expression.trim() + '\n$$\n\n'
      )
      .replace(
        /\\\(([\s\S]*?)\\\)/g,
        (_, expression: string) =>
          '$' + expression.trim() + '$'
      );
  }).join('');
}

interface ChatMessageContentProps {
  content: string;
}

export function ChatMessageContent({
  content,
}: ChatMessageContentProps) {
  return (
    <div
      dir="auto"
      className={[
        'prose prose-sm dark:prose-invert',
        'max-w-none min-w-0 break-words',
        '[&_.katex-display]:max-w-full',
        '[&_.katex-display]:overflow-x-auto',
        '[&_.katex-display]:overflow-y-hidden',
        '[&_pre]:max-w-full',
        '[&_pre]:overflow-x-auto',
      ].join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {normalizeMathDelimiters(content)}
      </ReactMarkdown>
    </div>
  );
}
