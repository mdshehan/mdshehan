import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/product-card';

export const revalidate = 900;

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brand = await api.getBrand(params.slug);
  if (!brand) return { title: 'Brand not found' };
  return {
    title: `${brand.name} — All Products, Prices & Specs`,
    description:
      brand.description ?? `Every ${brand.name} gadget with prices compared across stores.`,
    alternates: { canonical: `/brands/${brand.slug}` },
  };
}

export default async function BrandPage({ params }: Props) {
  const brand = await api.getBrand(params.slug);
  if (!brand) notFound();

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold">{brand.name}</h1>
      {brand.description && (
        <p className="mt-2 max-w-2xl text-muted-foreground">{brand.description}</p>
      )}

      <div className="mt-8">
        {brand.products.length === 0 ? (
          <p className="rounded-xl border p-8 text-center text-muted-foreground">
            No published products for this brand yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {brand.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
