'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';

const NAV: { href: string; label: string; permission?: string }[] = [
  { href: '/', label: '📊 Overview' },
  { href: '/products', label: '📦 Products', permission: 'product.view' },
  { href: '/brands', label: '🏷️ Brands', permission: 'brand.view' },
  { href: '/prices', label: '💲 Prices', permission: 'price.create' },
  { href: '/affiliate', label: '🔗 Affiliate', permission: 'affiliate.view' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, can, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr]">
      <aside className="border-r bg-card flex flex-col">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-bold">
          <span className="text-primary">◆</span> Admin
        </div>
        <nav className="flex-1 space-y-1 p-3 text-sm">
          {NAV.filter((item) => !item.permission || can(item.permission)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 transition-colors ${
                pathname === item.href
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3 text-sm">
          <div className="truncate font-medium">{user.fullName ?? user.email}</div>
          <div className="truncate text-xs text-muted-foreground">
            {user.roles.map((r) => r.label).join(', ') || '—'}
          </div>
          <button onClick={() => void signOut()} className="btn-ghost mt-2 w-full">
            Sign out
          </button>
        </div>
      </aside>
      <main className="p-6 overflow-x-auto">{children}</main>
    </div>
  );
}
