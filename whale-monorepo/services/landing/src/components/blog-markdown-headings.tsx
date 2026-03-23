import type { Components } from 'react-markdown';

/**
 * The article `<h1>` is the post title in `blog/[slug]/page.tsx`.
 * Markdown `#` / `##` / … map down one level so the page keeps exactly one H1
 * and body sections follow a clean H2 → H3 → … outline (SEO + AI extractability).
 */
export const blogArticleMarkdownComponents: Components = {
  h1: 'h2',
  h2: 'h3',
  h3: 'h4',
  h4: 'h5',
  h5: 'h6',
};
