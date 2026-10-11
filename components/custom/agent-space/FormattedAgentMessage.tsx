import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const tokenPattern = /\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)|(\*\*[^*]+\*\*)|(https?:\/\/[^\s]+)|([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(text.slice(cursor, index));

    if (match[1] && match[2]) {
      nodes.push(
        <a key={index} href={match[2]} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900">
          {match[1]}
        </a>,
      );
    } else if (match[3]) {
      nodes.push(<strong key={index} className="font-semibold text-slate-900">{match[3].slice(2, -2)}</strong>);
    } else if (match[4]) {
      const url = match[4].replace(/[.,!?;:]+$/, "");
      const trailing = match[4].slice(url.length);
      nodes.push(
        <span key={index}>
          <a href={url} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900">{url}</a>
          {trailing}
        </span>,
      );
    } else if (match[5]) {
      nodes.push(<a key={index} href={`mailto:${match[5]}`} className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900">{match[5]}</a>);
    }

    cursor = index + match[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function cleanLine(line: string) {
  return line.replace(/^\s*(?:[-*]|\u2022|\d+[.)])\s+/, "").trim();
}

export function FormattedAgentMessage({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let sectionCount = 0;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      const sectionLines = [numbered[2]];
      index += 1;
      while (index < lines.length && !/^\s*\d+[.)]\s+/.test(lines[index])) {
        if (lines[index].trim()) sectionLines.push(lines[index].trim());
        index += 1;
      }

      const title = sectionLines[0].replace(/^\*\*(.*)\*\*$/, "$1");
      const fields = sectionLines.slice(1);
      blocks.push(
        <section key={`section-${blocks.length}`} className={sectionCount > 0 ? "border-t border-slate-200 pt-3.5" : ""}>
          <h3 className="mb-2 text-[13px] font-semibold leading-5 text-slate-900">{renderInline(`${numbered[1]}. ${title}`)}</h3>
          {fields.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-[12px] leading-[1.55] text-slate-700 marker:text-slate-900">
              {fields.map((field, fieldIndex) => {
                const content = cleanLine(field);
                const label = content.match(/^([^:]{1,24}:)(\s*)(.*)$/);
                return (
                  <li key={fieldIndex}>
                    {label ? <><strong className="font-semibold text-slate-800">{label[1]}</strong>{label[2]}{renderInline(label[3])}</> : renderInline(content)}
                  </li>
                );
              })}
            </ul>
          )}
        </section>,
      );
      sectionCount += 1;
      continue;
    }

    if (/^\s*(?:[-*]|\u2022)\s+/.test(lines[index])) {
      const items: string[] = [];
      while (index < lines.length && /^\s*(?:[-*]|\u2022)\s+/.test(lines[index])) {
        items.push(cleanLine(lines[index]));
        index += 1;
      }
      blocks.push(
        <ul key={`list-${blocks.length}`} className="list-disc space-y-1 pl-5 text-[14px] leading-6 text-slate-700 marker:text-slate-400">
          {items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
        </ul>,
      );
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^\s*(?:[-*]|\u2022|\d+[.)])\s+/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`paragraph-${blocks.length}`} className="text-[14px] leading-6 text-slate-700">{renderInline(paragraph.join(" "))}</p>);
  }

  return (
    <div className="max-w-full rounded-2xl rounded-tl-md border border-slate-200 bg-slate-50/80 px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:px-5 sm:py-4">
      <div className="space-y-3">{blocks}</div>
    </div>
  );
}
