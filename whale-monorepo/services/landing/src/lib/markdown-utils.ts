// ---------------------------------------------------------------------------
// Markdown utility functions — pure, no React dependency
// ---------------------------------------------------------------------------

/**
 * Convert heading text to a URL-safe anchor ID.
 * Lowercase, strip non-alphanumeric (except spaces/hyphens), collapse whitespace
 * to hyphens, trim leading/trailing hyphens.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // strip special characters
    .replace(/\s+/g, '-') // spaces → hyphens
    .replace(/-+/g, '-') // collapse consecutive hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}

// ---------------------------------------------------------------------------
// Heading extraction
// ---------------------------------------------------------------------------

export type HeadingItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

/**
 * Extract H2 and H3 headings from a markdown string.
 * Returns them in document order with slugified IDs.
 * Excludes the FAQ section heading itself (but not sub-headings within FAQ).
 */
export function extractHeadings(markdown: string): HeadingItem[] {
  if (!markdown) return [];

  const headingRegex = /^#{2,3}\s+(.+)$/gm;
  const headings: HeadingItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const text = match[1].trim();
    const id = slugify(text);

    // Skip the FAQ section heading itself — it's a structural divider, not navigable content
    if (id === 'faq') continue;

    const level = match[0].startsWith('###') ? 3 : 2;
    headings.push({ id, text, level });
  }

  return headings;
}

// ---------------------------------------------------------------------------
// FAQ extraction — for FAQPage structured data (GEO / AI Overview optimisation)
// ---------------------------------------------------------------------------

export type FaqItem = {
  question: string;
  answer: string;
};

/**
 * Extract Q&A pairs from a "## FAQ" section in markdown.
 *
 * Recognizes these question formats:
 *   **Q1: question text**
 *   **Q: question text**
 *   **Question: question text**
 *
 * The answer is everything between this question marker and the next Q-marker
 * (or end of section).
 */
export function extractFaqItems(markdown: string): FaqItem[] {
  if (!markdown) return [];

  // Locate the FAQ section — from "## FAQ" to the next "## " heading or EOF
  const faqSectionMatch = markdown.match(/^## FAQ\s*\n([\s\S]*?)(?=^## [A-Za-z]|\n*$)/m);
  if (!faqSectionMatch) return [];

  const faqBody = faqSectionMatch[1];

  // Match Q&A pairs — Q line starts with **Q (optionally numbered), answer starts with A:
  const qaRegex = /\*\*Q\d{0,2}:\s*(.+?)\*\*\s*\n+.*?A:\s*([\s\S]*?)(?=\n+\*\*Q\d{0,2}:|\n*$)/g;
  const items: FaqItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = qaRegex.exec(faqBody)) !== null) {
    const question = match[1].trim();
    const answer = match[2]
      .trim()
      .replace(/\n+/g, ' ') // collapse newlines into single space for clean schema output
      .replace(/\s+/g, ' ')
      .trim();

    if (question && answer) {
      items.push({ question, answer });
    }
  }

  return items;
}
