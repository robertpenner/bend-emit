// Read through the declaration's final colon, not colons inside its types.
export function definitionHeader(lines: string[], start: number): { text: string; end: number } {
  const parts: string[] = [];
  let depth = 0;
  for (let end = start; end < lines.length; end++) {
    const line = lines[end].replace(/#.*$/, "").trim();
    if (end > start && /^(def|type|law|import)\s/.test(line)) break;
    parts.push(line);
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if ((ch === "-" || ch === "=") && line[i + 1] === ">") { i++; continue; }
      if ("({[<".includes(ch)) depth++;
      if (")}]>".includes(ch)) depth--;
      if (ch === ":" && depth === 0 && i === line.length - 1) {
        return { text: parts.join(" "), end };
      }
    }
  }
  throw new Error(`bend-emit: unterminated def header: ${lines[start]}`);
}
