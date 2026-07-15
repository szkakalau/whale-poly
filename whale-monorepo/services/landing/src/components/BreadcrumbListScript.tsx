/**
 * Shared BreadcrumbList JSON-LD component for SEO GEO.
 *
 * Usage in any layout/page:
 *   <BreadcrumbListJsonLd items={[{ name: 'Pricing', url: '/pricing' }]} />
 *
 * The "Home" item is always prepended automatically.
 */

interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * Safely serialize JSON for embedding in a <script> tag.
 * Escapes '<' to prevent premature script tag closing from
 * user-authored content (e.g., blog post titles containing '</script>').
 */
export function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

export function breadcrumbListJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.sightwhale.com/',
      },
      ...items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: item.name,
        item: `https://www.sightwhale.com${item.url}`,
      })),
    ],
  };
}

export function BreadcrumbListScript({ items }: { items: BreadcrumbItem[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbListJsonLd(items)) }}
    />
  );
}
