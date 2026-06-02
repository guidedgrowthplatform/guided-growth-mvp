export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string; href: string };

export type Block =
  | { type: 'ol'; items: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'p'; lines: string[] };

const INLINE_RE =
  /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|_([^_\n]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push({ type: 'text', value: text.slice(last, idx) });
    if (m[2] !== undefined) nodes.push({ type: 'bold', value: m[2] });
    else if (m[3] !== undefined) nodes.push({ type: 'bold', value: m[3] });
    else if (m[4] !== undefined) nodes.push({ type: 'italic', value: m[4] });
    else if (m[5] !== undefined) nodes.push({ type: 'italic', value: m[5] });
    else if (m[6] !== undefined) nodes.push({ type: 'code', value: m[6] });
    else if (m[7] !== undefined) nodes.push({ type: 'link', value: m[7], href: m[8] });
    last = idx + m[0].length;
  }
  if (last < text.length) nodes.push({ type: 'text', value: text.slice(last) });
  if (nodes.length === 0) nodes.push({ type: 'text', value: '' });
  return nodes;
}

export function safeStreamPrefix(text: string): string {
  let cut = text.length;

  if (((text.match(/`/g) ?? []).length & 1) === 1) {
    cut = Math.min(cut, text.lastIndexOf('`'));
  }
  if (((text.match(/\*\*/g) ?? []).length & 1) === 1) {
    cut = Math.min(cut, text.lastIndexOf('**'));
  }

  const lastOpen = text.lastIndexOf('[');
  if (lastOpen !== -1 && !/^\[[^\]]*\]\([^)\s]+\)/.test(text.slice(lastOpen))) {
    cut = Math.min(cut, lastOpen);
  }

  return cut === text.length ? text : text.slice(0, cut).trimEnd();
}

const OL_RE = /^\s*\d+\.\s+(.*)$/;
const UL_RE = /^\s*[-*]\s+(.*)$/;

export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length > 0) {
      blocks.push({ type: 'p', lines: para });
      para = [];
    }
  };

  for (const line of lines) {
    if (line.trim() === '') {
      flushPara();
      continue;
    }
    const ol = OL_RE.exec(line);
    const ul = UL_RE.exec(line);
    if (ol) {
      flushPara();
      const last = blocks[blocks.length - 1];
      if (last?.type === 'ol') last.items.push(ol[1]);
      else blocks.push({ type: 'ol', items: [ol[1]] });
    } else if (ul) {
      flushPara();
      const last = blocks[blocks.length - 1];
      if (last?.type === 'ul') last.items.push(ul[1]);
      else blocks.push({ type: 'ul', items: [ul[1]] });
    } else {
      para.push(line);
    }
  }
  flushPara();
  return blocks;
}
