import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';

const NAV = [
  { label: 'Phones', href: '/category/phones' },
  { label: 'Tablets', href: '/category/tablets' },
  { label: 'Laptops', href: '/category/laptops' },
  { label: 'Watches', href: '/category/watches' },
  { label: 'TVs', href: '/category/tvs' },
  { label: 'Deals', href: '/deals' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-primary">◆</span> Gadget Hub
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/search"
            className="hidden sm:inline-flex h-9 items-center rounded-lg border px-3 text-sm text-muted-foreground hover:bg-muted"
          >
            🔍 Search…
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
