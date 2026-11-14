/* Renderizador de Markdown simples e seguro (sem HTML bruto): parágrafos, títulos, listas, tabelas, código e destaques. */
import { useMemo, type ReactNode } from "react";

type Block =
  | { type: "p"; text: string }
  | { type: "h"; level: number; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "code"; lang: string; text: string };

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}/;
const UL_ITEM = /^\s*[-*•]\s+/;
const OL_ITEM = /^\s*\d+[.)]\s+/;

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const buffer: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buffer.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: "code", lang, text: buffer.join("\n") });
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "h", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (UL_ITEM.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL_ITEM.test(lines[i])) {
        items.push(lines[i].replace(UL_ITEM, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (OL_ITEM.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL_ITEM.test(lines[i])) {
        items.push(lines[i].replace(OL_ITEM, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    if (line.startsWith(">")) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoted.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: quoted.join(" ") });
      continue;
    }

    const paragraph = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("```") &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !UL_ITEM.test(lines[i]) &&
      !OL_ITEM.test(lines[i]) &&
      !TABLE_ROW.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push({ type: "p", text: paragraph.join(" ") });
  }

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g);
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={index} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-navy-800">
          {part.slice(1, -1)}
        </code>
      );
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      if (part.length > 2) {
        return (
          <em key={index} className="text-slate-600">
            {part.slice(1, -1)}
          </em>
        );
      }
    }
    return <span key={index}>{part}</span>;
  });
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.type) {
    case "h": {
      const Tag = block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5";
      return (
        <Tag key={index} className="pt-1 font-semibold text-navy-900">
          {renderInline(block.text)}
        </Tag>
      );
    }
    case "ul":
      return (
        <ul key={index} className="list-disc space-y-1 pl-5">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={index} className="list-decimal space-y-1 pl-5">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote key={index} className="border-l-4 border-sky-300 bg-sky-50/60 px-3 py-2 text-slate-700">
          {renderInline(block.text)}
        </blockquote>
      );
    case "table":
      return (
        <div key={index} className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {block.header.map((cell, i) => (
                  <th key={i} scope="col" className="px-3 py-2 font-semibold">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="px-3 py-2 align-top text-slate-700">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "code":
      return (
        <div key={index} className="overflow-hidden rounded-xl bg-slate-900">
          {block.lang && <div className="border-b border-white/10 px-3 py-1 text-[11px] uppercase tracking-wide text-slate-400">{block.lang}</div>}
          <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-slate-100">
            <code>{block.text}</code>
          </pre>
        </div>
      );
    default:
      return (
        <p key={index} className="whitespace-pre-line">
          {renderInline(block.text)}
        </p>
      );
  }
}

export function MarkdownContent({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);
  return <div className="space-y-3 text-sm leading-relaxed text-slate-800">{blocks.map((b, i) => renderBlock(b, i))}</div>;
}
