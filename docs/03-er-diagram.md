# 3. ER Diagram

> Rendered with Mermaid (`erDiagram`). Core entities and cardinalities. Polymorphic attach tables
> (`seo_metadata`, `schema_data`, `mediables`, `taggables`, `translations`) connect to many
> entities via `(entity_type, entity_id)` and are shown once.

## 3.1 Catalog + Commerce Core

```mermaid
erDiagram
    BRANDS ||--o{ PRODUCTS : has
    CATEGORIES ||--o{ PRODUCTS : classifies
    CATEGORIES ||--o{ CATEGORIES : "parent/child"
    PRODUCTS ||--o{ PRODUCT_VARIANTS : has
    PRODUCTS ||--o{ PRODUCT_SPECIFICATIONS : describes
    SPECIFICATION_GROUPS ||--o{ SPECIFICATION_ATTRIBUTES : groups
    SPECIFICATION_ATTRIBUTES ||--o{ PRODUCT_SPECIFICATIONS : valued_in
    CATEGORIES ||--o{ CATEGORY_ATTRIBUTES : exposes
    SPECIFICATION_ATTRIBUTES ||--o{ CATEGORY_ATTRIBUTES : in
    PRODUCTS ||--o{ PRODUCT_RELATIONS : relates
    PRODUCTS ||--o{ PRICES : offered_as
    PRODUCT_VARIANTS ||--o{ PRICES : priced_as
    STORES ||--o{ PRICES : sells
    COUNTRIES ||--o{ PRICES : in
    CURRENCIES ||--o{ PRICES : in
    PRODUCTS ||--o{ PRICE_HISTORY : tracks
    STORES ||--o{ AFFILIATE_LINKS : owns
    PRODUCTS ||--o{ AFFILIATE_LINKS : deeplinks
    AFFILIATE_LINKS ||--o{ AFFILIATE_CLICKS : generates
    STORES ||--o{ STORE_COUNTRIES : available_in
    COUNTRIES ||--o{ STORE_COUNTRIES : has

    PRODUCTS {
        uuid id PK
        string name
        citext slug UK
        uuid brand_id FK
        uuid category_id FK
        date release_date
        jsonb specs
        numeric rating_avg
        numeric min_price_usd
        enum status
    }
    PRICES {
        uuid id PK
        uuid product_id FK
        uuid variant_id FK
        uuid store_id FK
        uuid country_id FK
        numeric price
        numeric price_usd
        enum availability
    }
    AFFILIATE_LINKS {
        uuid id PK
        uuid store_id FK
        uuid product_id FK
        text target_url
        string short_code UK
    }
```

## 3.2 Reviews, Content & Localization

```mermaid
erDiagram
    PRODUCTS ||--o{ REVIEWS : receives
    USERS ||--o{ REVIEWS : writes
    REVIEWS ||--o{ RATING_CRITERIA : breaks_down
    USERS ||--o{ ARTICLES : authors
    CATEGORIES ||--o{ ARTICLES : files
    ARTICLES ||--o{ ARTICLE_PRODUCTS : references
    PRODUCTS ||--o{ ARTICLE_PRODUCTS : featured_in
    LAYOUTS ||--o{ LAYOUT_BLOCKS : composed_of
    LAYOUT_BLOCKS ||--o{ LAYOUT_BLOCKS : nests
    MENUS ||--o{ MENU_ITEMS : contains
    MENU_ITEMS ||--o{ MENU_ITEMS : nests
    COUNTRIES }o--|| CURRENCIES : uses
    COUNTRIES }o--|| LANGUAGES : default
    LANGUAGES ||--o{ TRANSLATIONS : provides
    PRODUCTS ||--o{ PRICE_ALERTS : watched_by
    USERS ||--o{ PRICE_ALERTS : sets
```

## 3.3 Identity, Ads & SEO

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : assigned
    ROLES ||--o{ USER_ROLES : grants
    ROLES ||--o{ ROLE_PERMISSIONS : includes
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : in
    USERS ||--o{ USER_PERMISSIONS : overrides
    USERS ||--o{ AUTH_SESSIONS : has
    AD_SLOTS ||--o{ ADVERTISEMENTS : holds
    COUNTRIES ||--o{ ADVERTISEMENTS : targets
    CATEGORIES ||--o{ ADVERTISEMENTS : targets
    MEDIA ||--o{ MEDIABLES : attached_via

    %% Polymorphic attachments (entity_type + entity_id) — apply to
    %% PRODUCTS, ARTICLES, PAGES, CATEGORIES, BRANDS
    SEO_METADATA {
        uuid id PK
        string entity_type
        uuid entity_id
        string meta_title
        text canonical_url
        string robots
    }
    SCHEMA_DATA {
        uuid id PK
        string entity_type
        uuid entity_id
        string schema_type
        jsonb json_ld
    }
    REDIRECTS {
        uuid id PK
        text from_path UK
        text to_path
        enum type
    }
```

## 3.4 Legend

- `||--o{` one-to-many, `}o--||` many-to-one, `||--||` one-to-one.
- **PK** primary key, **FK** foreign key, **UK** unique key.
- Tables not drawn but present: `tags`/`taggables`, `media`/`mediables`, `settings`,
  `notifications`, `activity_logs`, `seo_hreflangs`, `pages` — all referenced in §2.
