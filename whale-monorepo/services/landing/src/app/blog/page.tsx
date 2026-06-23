import { redirect } from 'next/navigation';

/**
 * /blog — always defaults to English.
 */
export default function BlogPage() {
  redirect('/blog/en');
}
