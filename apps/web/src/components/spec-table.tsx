import type { ProductDetail } from '@/lib/types';

export function SpecTable({ product }: { product: ProductDetail }) {
  // Prefer normalized specifications; fall back to the JSONB specs snapshot.
  const rows =
    product.specifications?.length > 0
      ? product.specifications.map((s) => ({
          label: s.attribute.label,
          value: `${s.valueString ?? s.valueNumber ?? ''}${s.attribute.unit ? ` ${s.attribute.unit}` : ''}`,
        }))
      : Object.entries(product.specs ?? {}).map(([k, v]) => ({
          label: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          value: String(v),
        }));

  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} className={i % 2 ? 'bg-muted/30' : ''}>
              <td className="px-4 py-2.5 w-1/3 font-medium text-muted-foreground capitalize">
                {row.label}
              </td>
              <td className="px-4 py-2.5">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
