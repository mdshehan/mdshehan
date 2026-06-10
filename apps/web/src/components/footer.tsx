import Link from 'next/link';

const COLUMNS = [
  { title: 'Categories', links: ['Phones', 'Tablets', 'Laptops', 'TVs', 'Cameras'] },
  { title: 'Company', links: ['About', 'Contact', 'Careers', 'Press'] },
  { title: 'Legal', links: ['Privacy', 'Terms', 'Cookies', 'Affiliate Disclosure'] },
];

export function Footer() {
  return (
    <footer className="border-t mt-16">
      <div className="container-page py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <div className="font-bold text-lg flex items-center gap-2">
            <span className="text-primary">◆</span> Gadget Hub
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Compare gadget prices &amp; specs worldwide.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="font-semibold text-sm">{col.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {col.links.map((l) => (
                <li key={l}>
                  <Link href="#" className="hover:text-foreground">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="container-page py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Global Gadget Price Hub. Prices may include affiliate links.
        </div>
      </div>
    </footer>
  );
}
