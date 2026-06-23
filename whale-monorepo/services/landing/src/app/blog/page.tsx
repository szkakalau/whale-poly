import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * /blog — auto-detects language from Accept-Language header, redirects to /blog/en or /blog/zh.
 * Falls back to English.
 */
export default async function BlogPage() {
  const headersList = await headers();
  const acceptLang = headersList.get('accept-language') || '';
  const prefersZh = acceptLang.toLowerCase().includes('zh');
  const language = prefersZh ? 'zh' : 'en';

  redirect(`/blog/${language}`);
}
