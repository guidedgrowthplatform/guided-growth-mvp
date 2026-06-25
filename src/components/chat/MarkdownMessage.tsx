import { Fragment, memo, useMemo } from 'react';
import { parseBlocks, parseInline, type InlineNode } from '@/lib/markdown/parse';

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case 'bold':
            return (
              <strong key={i} className="font-bold">
                {n.value}
              </strong>
            );
          case 'italic':
            return <em key={i}>{n.value}</em>;
          case 'code':
            return (
              <code key={i} className="rounded bg-black/10 px-1 py-0.5 text-[0.9em]">
                {n.value}
              </code>
            );
          case 'link':
            return (
              <a
                key={i}
                href={n.href}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                {n.value}
              </a>
            );
          default:
            return <Fragment key={i}>{n.value}</Fragment>;
        }
      })}
    </>
  );
}

function MultilineInline({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          <Inline nodes={parseInline(line)} />
        </Fragment>
      ))}
    </>
  );
}

export const MarkdownMessage = memo(function MarkdownMessage({ text }: { text: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return (
    <>
      {blocks.map((block, i) => {
        const spacing = i > 0 ? 'mt-2' : '';
        if (block.type === 'ol') {
          return (
            <ol key={i} className={`list-decimal space-y-1 pl-5 ${spacing}`}>
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inline nodes={parseInline(item)} />
                </li>
              ))}
            </ol>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={i} className={`list-disc space-y-1 pl-5 ${spacing}`}>
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inline nodes={parseInline(item)} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className={spacing}>
            <MultilineInline lines={block.lines} />
          </p>
        );
      })}
    </>
  );
});
