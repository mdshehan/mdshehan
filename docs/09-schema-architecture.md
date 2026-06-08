# 9. Schema (JSON-LD) Architecture

All structured data is **JSON-LD only**, generated server-side by the `packages/schema-ld` builders
and injected into the SSR/ISR HTML `<head>`. Auto-generated output is cached in `schema_data` and
can be overridden per entity in the admin Schema Manager.

## 9.1 Schema Coverage

| Schema type | Where | Source |
|-------------|-------|--------|
| `Product` + `Offer`/`AggregateOffer` | product pages | products + prices |
| `AggregateRating` + `Review` | product/review pages | reviews, rating_avg/count |
| `FAQPage` | product/guide pages | auto FAQ + editorial |
| `BreadcrumbList` | all deep pages | category path |
| `Article`/`NewsArticle` | content pages | articles |
| `Organization` | global | settings |
| `WebSite` + `SearchAction` | global (sitelinks search box) | settings |
| `ItemList` | listings/comparisons | product lists |

## 9.2 Product (with multi-store offers)

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Samsung Galaxy S25 Ultra",
  "image": ["https://cdn.gadgethub.com/p/s25u/1.webp"],
  "description": "6.9-inch AMOLED, Snapdragon 8 Gen 4, 200MP camera, 5000mAh.",
  "sku": "SM-S938B",
  "gtin": "8806095000000",
  "brand": { "@type": "Brand", "name": "Samsung" },
  "category": "Smartphones",
  "releaseDate": "2026-01-22",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.6", "bestRating": "5", "ratingCount": 1204
  },
  "review": [{
    "@type": "Review",
    "reviewRating": {"@type":"Rating","ratingValue":"4.6","bestRating":"5"},
    "author": {"@type":"Organization","name":"Gadget Hub Experts"}
  }],
  "offers": {
    "@type": "AggregateOffer",
    "priceCurrency": "USD",
    "lowPrice": "1199.00",
    "highPrice": "1299.00",
    "offerCount": 3,
    "offers": [
      {"@type":"Offer","price":"1199.00","priceCurrency":"USD",
       "availability":"https://schema.org/InStock",
       "url":"https://gadgethub.com/go/abc123",
       "seller":{"@type":"Organization","name":"Amazon"},
       "priceValidUntil":"2026-12-31"}
    ]
  }
}
```

## 9.3 Comparison page (`ItemList`) + FAQ

```json
{
  "@context":"https://schema.org",
  "@type":"ItemList",
  "itemListElement":[
    {"@type":"ListItem","position":1,"item":{"@type":"Product","name":"iPhone 16 Pro"}},
    {"@type":"ListItem","position":2,"item":{"@type":"Product","name":"Galaxy S25 Ultra"}}
  ]
}
```
```json
{
  "@context":"https://schema.org","@type":"FAQPage",
  "mainEntity":[
    {"@type":"Question","name":"Which is cheaper, iPhone 16 Pro or Galaxy S25 Ultra?",
     "acceptedAnswer":{"@type":"Answer","text":"The Galaxy S25 Ultra starts at $1,199..."}}
  ]
}
```

## 9.4 BreadcrumbList + Organization + WebSite

```json
{ "@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
  {"@type":"ListItem","position":1,"name":"Home","item":"https://gadgethub.com/"},
  {"@type":"ListItem","position":2,"name":"Phones","item":"https://gadgethub.com/phones"},
  {"@type":"ListItem","position":3,"name":"Galaxy S25 Ultra"}]}
```
```json
{ "@context":"https://schema.org","@type":"WebSite",
  "url":"https://gadgethub.com/",
  "potentialAction":{"@type":"SearchAction",
    "target":"https://gadgethub.com/search?q={query}","query-input":"required name=query"}}
```

## 9.5 Generation Pipeline

```
build product page
  → schema-ld.buildProduct(product, offers, reviews)   # pure function, typed
  → merge with override from schema_data (if auto_generated=false)
  → validate against @type shape (dev: assert required fields)
  → inject <script type="application/ld+json"> server-side
  → persist auto JSON to schema_data for admin preview + audit
```

- **Price accuracy**: offers reflect current `prices` at render; ISR revalidation on price change
  keeps `lowPrice`/`availability` fresh to avoid "price mismatch" Merchant/Rich-Result warnings.
- **Validation**: schema builders are unit-tested; CI runs a structured-data lint; admin shows
  Rich Results eligibility hints.
- **No duplication**: one consolidated graph per page where possible (`@graph`) to avoid conflicts.
