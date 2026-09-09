// The model breaks a single paragraph across multiple lines two different
// ways: a plain "\n" after every sentence, and — around web-search-cited
// material — a full blank line landing mid-sentence, e.g. "...the\n\nNational
// Terrorism Advisory System Bulletin...\n\n. That bulletin\n\nwas set to
// expire...". The second kind looks like a real paragraph break (blank line)
// but isn't one, so a blank line is only kept when it's actually justified:
// the text before it ends a sentence, or what follows is a heading/list.
// Anything else — blank or not — gets merged into the previous line, with no
// space inserted before punctuation that attaches to the prior word.
export function normalizeReportMarkdown(text: string): string {
  const isStructural = (line: string) => /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s)/.test(line);
  const endsSentence = (line: string) => /[.!?]["')\]]*\s*$/.test(line);
  const isAttachingPunctuation = (line: string) => /^\s*[.,;:!?)\]}]/.test(line);

  const lines = text.split("\n");
  const result: string[] = [];

  const nextNonBlank = (fromIndex: number) => {
    for (let i = fromIndex; i < lines.length; i++) {
      if (lines[i].trim() !== "") return lines[i];
    }
    return "";
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const previous = result[result.length - 1];
    const previousIsBlank = previous === undefined || previous.trim() === "";

    if (line.trim() === "") {
      const isGenuineBreak =
        previousIsBlank || isStructural(previous) || endsSentence(previous) || isStructural(nextNonBlank(i + 1));
      if (isGenuineBreak && !previousIsBlank) result.push(line);
      continue;
    }

    if (result.length === 0 || previousIsBlank || isStructural(line) || isStructural(previous)) {
      result.push(line);
      continue;
    }

    const glue = isAttachingPunctuation(line) ? "" : " ";
    result[result.length - 1] = `${previous.replace(/\s+$/, "")}${glue}${line.replace(/^\s+/, "")}`;
  }
  return result.join("\n");
}
