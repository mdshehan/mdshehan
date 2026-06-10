import Link from 'next/link';
import type { ProductListItem } from '@/lib/types';
import { usd, rating } from '@/lib/format';

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group rounded-xl border bg-card p-4 transition-shadow hover:shadow-lg"
    >
      <div className="aspect-square rounded-lg bg-muted flex items-center justify-center text-4xl">
        📱
      </div>
      <div className="mt-3">
        {product.brand && (
          <div className="text-xs text-muted-foreground">{product.brand.name}</div>
        )}
        <h3 className="font-medium leading-snug line-clamp-2 group-hover:text-primary">
          {product.name}
        </h3>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-semibold">{usd(product.minPriceUsd)}</span>
          <span className="text-xs text-amber-500">★ {rating(product.ratingAvg)}</span>
        </div>
      </div>
    </Link>
  );
}
