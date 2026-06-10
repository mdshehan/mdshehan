import type { SearchResult } from '@/lib/types';

interface Props {
  action: string; // form GET target (current page path)
  current: Record<string, string | undefined>;
  facets: SearchResult['facets'];
  showCategoryFilter?: boolean;
}

/**
 * Faceted filter sidebar as a plain GET form — works without JavaScript,
 * keeps filters in the URL (shareable + crawlable), zero client JS cost.
 */
export function FilterSidebar({ action, current, facets, showCategoryFilter }: Props) {
  const brandFacet = facets.brandSlug ?? {};
  const ramFacet = facets.ram ?? {};
  const storageFacet = facets.storage ?? {};

  return (
    <form method="get" action={action} className="space-y-5 rounded-xl border p-4 text-sm">
      {current.q && <input type="hidden" name="q" value={current.q} />}

      <FacetSelect
        label="Brand"
        name="brand"
        value={current.brand}
        options={Object.keys(brandFacet).map((k) => ({
          value: k,
          label: `${k} (${brandFacet[k]})`,
        }))}
      />

      {showCategoryFilter && (
        <FacetSelect
          label="Category"
          name="category"
          value={current.category}
          options={Object.keys(facets.categorySlug ?? {}).map((k) => ({ value: k, label: k }))}
        />
      )}

      <div>
        <label className="font-medium">Price (USD)</label>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            name="price_min"
            placeholder="Min"
            defaultValue={current.price_min}
            className="w-full rounded-lg border bg-background px-2 py-1.5"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            name="price_max"
            placeholder="Max"
            defaultValue={current.price_max}
            className="w-full rounded-lg border bg-background px-2 py-1.5"
          />
        </div>
      </div>

      <FacetSelect
        label="RAM (GB)"
        name="ram"
        value={current.ram}
        options={Object.keys(ramFacet)
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => ({ value: k, label: `${k} GB (${ramFacet[k]})` }))}
      />

      <FacetSelect
        label="Storage (GB)"
        name="storage"
        value={current.storage}
        options={Object.keys(storageFacet)
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => ({ value: k, label: `${k} GB (${storageFacet[k]})` }))}
      />

      <FacetSelect
        label="Sort by"
        name="sort"
        value={current.sort}
        emptyLabel="Relevance"
        options={[
          { value: 'price', label: 'Price: low → high' },
          { value: '-price', label: 'Price: high → low' },
          { value: 'rating', label: 'Top rated' },
          { value: 'release', label: 'Newest' },
        ]}
      />

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground hover:opacity-90"
        >
          Apply
        </button>
        <a href={action} className="rounded-lg border px-3 py-2 hover:bg-muted">
          Reset
        </a>
      </div>
    </form>
  );
}

function FacetSelect({
  label,
  name,
  value,
  options,
  emptyLabel = 'Any',
}: {
  label: string;
  name: string;
  value?: string;
  options: { value: string; label: string }[];
  emptyLabel?: string;
}) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="font-medium">
        {label}
      </label>
      <select
        id={`f-${name}`}
        name={name}
        defaultValue={value ?? ''}
        className="mt-2 w-full rounded-lg border bg-background px-2 py-1.5"
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
