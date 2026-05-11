import { redirect } from '@/i18n/routing';

export default function Home({ params: { locale } }: { params: { locale: string } }) {
  redirect({ href: '/dashboard', locale });
}
