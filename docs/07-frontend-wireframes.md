# 7. Frontend Wireframes

Design language = **GSMArena's data density + Apple's polish + Amazon's price/CTA clarity +
PriceRunner's comparison tables + PhoneArena's editorial**. Mobile-first, responsive, dark/light,
accessible (WCAG 2.2 AA), SEO-optimized, Core Web Vitals green.

> ASCII wireframes below; production design uses Tailwind + shadcn/ui tokens with an 8-pt grid.

## 7.1 Homepage

```
┌───────────────────────────────────────────────────────────────┐
│ [Logo]  Phones Tablets Laptops Watches TVs ▾   🔍search  🌍US ☾ │  ← sticky header + mega menu
├───────────────────────────────────────────────────────────────┤
│  HERO: Featured launch  [big image] "Galaxy S25 Ultra"          │
│        from $1199 · ★4.6 · [Compare] [See Prices]   [banner ad] │
├───────────────────────────────────────────────────────────────┤
│  🔥 Trending Products   [card][card][card][card][card]  →        │
├───────────────────────────────────────────────────────────────┤
│  🆕 Latest Launches     [card][card][card][card]  →             │
├───────────────────────────────────────────────────────────────┤
│  🏷️ Top Deals (country-aware)  [deal][deal][deal][deal]         │
├───────────────────────────────────────────────────────────────┤
│  Popular Brands   [Apple][Samsung][Xiaomi][Sony][Google]...     │
├───────────────────────────────────────────────────────────────┤
│  ⭐ Latest Reviews  [review][review]   │  📰 Latest News [list]  │
├───────────────────────────────────────────────────────────────┤
│  ⚖️ Popular Comparisons  "iPhone 16 vs S25"  "Pixel 9 vs ..."   │
├───────────────────────────────────────────────────────────────┤
│  📚 Buying Guides  [guide][guide][guide]                        │
├───────────────────────────────────────────────────────────────┤
│  ✉️ Newsletter  [email____] [Subscribe]                          │
├───────────────────────────────────────────────────────────────┤
│  Footer: Categories · Brands · Company · Legal · Social · 🌍/💱 │
└───────────────────────────────────────────────────────────────┘
```
Blocks are **server-rendered from the active homepage `layout`** (builder-driven, ISR-cached).

## 7.2 Product Page (the money page)

```
┌───────────────────────────────────────────────────────────────┐
│ Breadcrumb: Home › Phones › Samsung › Galaxy S25 Ultra          │
├──────────────────────────────┬────────────────────────────────┤
│  [ Gallery / image zoom ]    │  Galaxy S25 Ultra  ★4.6 (1,204) │
│  [thumb][thumb][thumb]       │  Samsung · Released Jan 2026    │
│                              │  ┌──────────────────────────┐   │
│                              │  │ Best price  $1,199 @ Amazon│  │
│                              │  │ [Buy at Amazon →] (affil.) │  │
│                              │  │ also: BestBuy $1,219 ...   │  │
│                              │  └──────────────────────────┘   │
│                              │  Variant: [256GB][512GB][1TB]   │
│                              │  Color:   ●●●●                   │
├──────────────────────────────┴────────────────────────────────┤
│  ⚡ Quick Specs:  6.9" AMOLED · SD8 Gen4 · 12GB · 200MP · 5000mAh│
├───────────────────────────────────────────────────────────────┤
│  💲 PRICE COMPARISON (country-aware)                            │
│  Store     Price     Availability   Updated      [Buy]          │
│  Amazon    $1,199    In stock       2h ago       [Go →]         │
│  BestBuy   $1,219    In stock       5h ago       [Go →]         │
│  Walmart   $1,249    In stock       1d ago       [Go →]         │
├───────────────────────────────────────────────────────────────┤
│  📈 Price History  [line chart 6m / 1y toggle]   ⬇ lowest $1,149 │
├───────────────────────────────────────────────────────────────┤
│  📋 Full Specifications (grouped, expandable)                   │
│  Display ▸ Performance ▸ Camera ▸ Battery ▸ Connectivity ▸ ...  │
├───────────────────────────────────────────────────────────────┤
│  ✅ Pros            │  ❌ Cons          [in-content ad]          │
├───────────────────────────────────────────────────────────────┤
│  🧪 Expert Review (editorial) + score breakdown bars            │
├───────────────────────────────────────────────────────────────┤
│  🗣️ User Reviews + rating histogram  [Write a review]          │
├───────────────────────────────────────────────────────────────┤
│  🔗 Related / Similar Products  [card][card][card][card]        │
└───────────────────────────────────────────────────────────────┘
  (Sticky mobile bar: "Best $1,199 · Buy at Amazon →")
  JSON-LD injected: Product + AggregateRating + Offer + Breadcrumb + FAQ
```

## 7.3 Category / Listing (faceted)

```
┌───────────────┬───────────────────────────────────────────────┐
│ FILTERS       │  Smartphones (4,182)   Sort: [Popularity ▾]    │
│ Brand ☐Apple  │  [card][card][card][card]                      │
│ Price [▭▭▭]   │  [card][card][card][card]                      │
│ RAM ☐8 ☐12    │  [card][card][card][card]                      │
│ Storage ...   │  ...                                           │
│ Processor     │  [Load more / infinite scroll + ISR]           │
│ Camera        │                                                │
│ Battery       │   sidebar ad                                   │
│ Release date  │                                                │
│ [Apply]       │                                                │
└───────────────┴───────────────────────────────────────────────┘
Facets come from /categories/{slug}/facets (counts from search engine).
URL reflects filters (?filter[ram]=12) for SEO + shareability.
```

## 7.4 Comparison (2–4 products)

```
┌──────────────┬──────────┬──────────┬──────────┬──────────┐
│              │ Product A│ Product B│ Product C│ Product D│
├──────────────┼──────────┼──────────┼──────────┼──────────┤
│ Image        │  [img]   │  [img]   │  [img]   │  [+ add] │
│ Best Price   │ $1,199   │ $999     │ $1,099   │          │
│ Rating       │ ★4.6     │ ★4.4     │ ★4.5     │          │
│ Display      │ 6.9"     │ 6.7"     │ 6.8"     │  (diffs  │
│ Chipset      │ SD8G4    │ A18 Pro  │ Tensor G4│  high-   │
│ RAM          │ 12GB     │ 8GB      │ 12GB     │  lighted)│
│ Battery      │ 5000mAh  │ 4685mAh  │ 5050mAh  │          │
│ Pros / Cons  │  ...     │  ...     │  ...     │          │
│ [Buy]        │ [Go→]    │ [Go→]    │ [Go→]    │          │
└──────────────┴──────────┴──────────┴──────────┴──────────┘
"Highlight differences" toggle · sticky first column · horizontal scroll on mobile.
```

## 7.5 Search

```
🔍 [ galaxy s2|                    ]
   ┌─ Autocomplete ───────────────┐
   │ Products  · Galaxy S25 Ultra │   ← typeahead < 50ms (Meili)
   │           · Galaxy S25+      │
   │ Brands    · Samsung          │
   │ Categories· Smartphones      │
   │ AI suggest· "best camera ph."│
   └──────────────────────────────┘
Results page = faceted listing + "did you mean" + zero-result fallback suggestions.
```

## 7.6 Design System Notes
- **Typography**: Inter/Geist; fluid `clamp()` scale. **Spacing**: 8-pt grid.
- **Theme tokens**: CSS variables for light/dark; `prefers-color-scheme` + manual toggle persisted.
- **Components** (shadcn/ui): Card, Table, Tabs, Accordion, Sheet (mobile filters), Command (search),
  Carousel, Skeleton (loading), Chart (price history via Recharts/visx).
- **Performance**: `next/image` (AVIF/WebP, blurhash LQIP), route-level code splitting, RSC for
  data-heavy sections, defer ads + below-fold via `loading="lazy"`/IntersectionObserver, font
  `display: swap`, reserve image dimensions (no CLS).
- **Accessibility**: semantic landmarks, focus-visible rings, ARIA on interactive widgets, color
  contrast ≥ 4.5:1, keyboard-navigable comparison/menus, reduced-motion support.
