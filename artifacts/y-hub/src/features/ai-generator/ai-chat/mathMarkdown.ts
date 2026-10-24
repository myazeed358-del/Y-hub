/** Normalize delimiters, not mathematics: never guess whether raw prose is code. */
function escaped(text: string, at: number) {
  let count = 0;
  while (at > 0 && text[--at] === "\\") count++;
  return count % 2 === 1;
}
function closing(text: string, marker: string, start: number) {
  for (let i = start; i < text.length; i++) {
    if (text.startsWith(marker, i) && !escaped(text, i)) return i;
  }
  return -1;
}
function prose(text: string, omitProtected = false): string {
  let out = "";
  for (let i = 0; i < text.length;) {
    // CommonMark code spans may use any number of backticks, including newlines.
    if (text[i] === "`" && !escaped(text, i)) {
      const run = text.slice(i).match(/^`+/)![0];
      let end = text.indexOf(run, i + run.length);
      while (
        end >= 0 && (text[end - 1] === "`" || text[end + run.length] === "`")
      ) end = text.indexOf(run, end + run.length);
      if (end >= 0) {
        out += omitProtected ? " " : text.slice(i, end + run.length);
        i = end + run.length;
        continue;
      }
    }
    const open = !escaped(text, i) &&
      (text.startsWith("\\[", i)
        ? "\\["
        : text.startsWith("\\(", i)
        ? "\\("
        : text.startsWith("$$", i)
        ? "$$"
        : text[i] === "$"
        ? "$"
        : "");
    if (open) {
      const close = open === "\\[" ? "\\]" : open === "\\(" ? "\\)" : open;
      const end = closing(text, close, i + open.length);
      if (end >= 0) {
        const expression = text.slice(i + open.length, end);
        if (omitProtected) out += " ";
        else if (open === "\\[" || open === "$$") {
          out += "\n\n$$\n" + expression.trim() + "\n$$\n\n";
        } else if (open === "\\(") out += "$" + expression.trim() + "$";
        else out += text.slice(i, end + close.length);
        i = end + close.length;
        continue;
      }
    }
    out += text[i++];
  }
  return out;
}
function transform(content: string, omitProtected = false) {
  const lines = content.split(/(?<=\n)/);
  let indented = false, blank = true;
  let out = "",
    pending = "",
    fence: { char: string; length: number } | null = null;
  for (const line of lines) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})([^\n]*)/);
    if (fence) {
      if (!omitProtected) out += line;
      if (
        marker && marker[1][0] === fence.char &&
        marker[1].length >= fence.length && !marker[2].trim()
      ) fence = null;
      blank = false;
      continue;
    }
    const visible = prose(pending, true);
    let openDisplay = false;
    for (let i = 0; i < visible.length; i++) {
      if (
        !escaped(visible, i) &&
        (visible.startsWith("\\[", i) || visible.startsWith("$$", i))
      ) {
        openDisplay = true;
        break;
      }
    }
    if (/^( {4}|\t)/.test(line) && (indented || blank) && !openDisplay) {
      out += prose(pending, omitProtected);
      pending = "";
      out += omitProtected ? "\n" : line;
      indented = true;
      blank = false;
      continue;
    }
    if (indented && !line.trim()) {
      out += omitProtected ? "\n" : line;
      blank = true;
      continue;
    }
    indented = false;
    if (marker && (marker[1][0] !== "`" || !marker[2].includes("`"))) {
      out += prose(pending, omitProtected);
      pending = "";
      fence = { char: marker[1][0], length: marker[1].length };
      out += omitProtected ? "\n" : line;
    } else pending += line;
    blank = !line.trim();
  }
  return out + prose(pending, omitProtected);
}
export const normalizeMathDelimiters = (content: string) => transform(content);
export const messageDirection = (content: string): "rtl" | "ltr" =>
  /[\u0621-\u064a\u066e-\u06d3]/u.test(transform(content, true))
    ? "rtl"
    : "ltr";
