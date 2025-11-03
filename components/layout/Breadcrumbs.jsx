import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Breadcrumbs() {
  const router = useRouter();
  const parts = router.asPath.split('?')[0].split('/').filter(Boolean);
  const crumbs = [
    { href: '/', label: 'Home' },
    ...parts.map((p, i) => ({
      href: '/' + parts.slice(0, i + 1).join('/'),
      label: p.charAt(0).toUpperCase() + p.slice(1),
    })),
  ];
  return (
    <nav className="mb-4 text-xs text-slate-500 print:hidden">
      {crumbs.map((c, i) => (
        <span key={c.href}>
          {i > 0 && <span className="mx-1">/</span>}
          <Link href={c.href}>
            <span className="hover:text-slate-700">{c.label}</span>
          </Link>
        </span>
      ))}
    </nav>
  );
}
