import type { Offer } from '@/lib/types';
import { money, availabilityLabel } from '@/lib/format';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function buyHref(offer: Offer): string {
  if (offer.affiliateLink?.shortCode) return `${API_URL}/go/${offer.affiliateLink.shortCode}`;
  return offer.productUrl ?? '#';
}

export function PriceTable({ offers }: { offers: Offer[] }) {
  if (offers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No prices available for your region yet.</p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Store</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3 hidden sm:table-cell">Availability</th>
            <th className="px-4 py-3 text-right">Buy</th>
          </tr>
        </thead>
        <tbody>
          {offers.map((offer, i) => (
            <tr key={offer.id} className="border-t">
              <td className="px-4 py-3 font-medium">{offer.store.name}</td>
              <td className="px-4 py-3">
                <span className="font-semibold">{money(offer.price, offer.currency.symbol)}</span>
                {i === 0 && (
                  <span className="ml-2 rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                    BEST
                  </span>
                )}
              </td>
              <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                {availabilityLabel(offer.availability)}
              </td>
              <td className="px-4 py-3 text-right">
                <a
                  href={buyHref(offer)}
                  rel="nofollow sponsored noopener"
                  target="_blank"
                  className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  Go →
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
