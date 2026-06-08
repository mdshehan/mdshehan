-- =====================================================================
-- Global Gadget Price Hub — PostgreSQL 16 Schema
-- Enterprise gadget price-comparison + content + affiliate platform
-- Conventions:
--   * snake_case, plural table names
--   * UUID v7 primary keys (time-ordered) via app or pg extension
--   * created_at / updated_at on every table; soft-delete via deleted_at where useful
--   * money stored as NUMERIC(14,2); FX-normalized USD columns for sorting/analytics
--   * JSONB for flexible/sparse attributes (specs, schema, settings)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- fuzzy text search / LIKE indexes
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "citext";        -- case-insensitive emails/slugs

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
CREATE TYPE availability_status AS ENUM ('in_stock','out_of_stock','preorder','discontinued','coming_soon');
CREATE TYPE product_status      AS ENUM ('draft','published','archived','scheduled');
CREATE TYPE content_status      AS ENUM ('draft','review','published','scheduled','archived');
CREATE TYPE review_type         AS ENUM ('expert','user','editorial');
CREATE TYPE moderation_status   AS ENUM ('pending','approved','rejected','spam');
CREATE TYPE ad_placement        AS ENUM ('header','footer','sidebar','in_content','product','listing','interstitial','sticky_mobile');
CREATE TYPE ad_type             AS ENUM ('adsense','ad_manager','afs','custom_html','affiliate_banner','direct');
CREATE TYPE device_target       AS ENUM ('all','desktop','mobile','tablet');
CREATE TYPE redirect_type       AS ENUM ('301','302','307','410');
CREATE TYPE notification_channel AS ENUM ('in_app','email','sms','push','webhook');

-- =====================================================================
-- 1. IDENTITY & ACCESS (Users, Roles, Permissions)
-- =====================================================================
CREATE TABLE roles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(60) NOT NULL UNIQUE,           -- super_admin, admin, editor, seo_manager, product_manager, ad_manager, vendor_manager
    label         VARCHAR(120) NOT NULL,
    description   TEXT,
    is_system     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(120) NOT NULL UNIQUE,           -- e.g. product.create, ad.update, seo.manage
    group_name    VARCHAR(60) NOT NULL,                   -- product, content, ad, seo, user...
    description   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT NOT NULL UNIQUE,
    username        CITEXT UNIQUE,
    password_hash   TEXT,                                  -- nullable for OAuth-only accounts
    full_name       VARCHAR(160),
    avatar_media_id UUID,                                  -- FK added after media table
    phone           VARCHAR(30),
    locale          VARCHAR(10) DEFAULT 'en',
    country_id      UUID,                                  -- FK added after countries
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_staff        BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ,
    two_factor_secret TEXT,
    last_login_at   TIMESTAMPTZ,
    last_login_ip   INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

CREATE TABLE user_roles (
    user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id  UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Direct per-user permission overrides (grant/deny on top of roles)
CREATE TABLE user_permissions (
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    effect        VARCHAR(5) NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow','deny')),
    PRIMARY KEY (user_id, permission_id)
);

CREATE TABLE auth_sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    user_agent    TEXT,
    ip            INET,
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON auth_sessions(user_id);

-- =====================================================================
-- 2. LOCALIZATION (Countries, Currencies, Languages)
-- =====================================================================
CREATE TABLE currencies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          CHAR(3) NOT NULL UNIQUE,                 -- ISO 4217: USD, EUR, BDT
    name          VARCHAR(80) NOT NULL,
    symbol        VARCHAR(8) NOT NULL,
    decimals      SMALLINT NOT NULL DEFAULT 2,
    usd_rate      NUMERIC(18,8) NOT NULL DEFAULT 1,        -- 1 unit = X USD (refreshed by FX job)
    rate_updated_at TIMESTAMPTZ,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE languages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          VARCHAR(10) NOT NULL UNIQUE,             -- BCP-47: en, en-US, bn, fr
    name          VARCHAR(80) NOT NULL,
    native_name   VARCHAR(80),
    direction     VARCHAR(3) NOT NULL DEFAULT 'ltr' CHECK (direction IN ('ltr','rtl')),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE countries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iso2            CHAR(2) NOT NULL UNIQUE,                -- US, BD, GB
    iso3            CHAR(3) NOT NULL UNIQUE,
    name            VARCHAR(120) NOT NULL,
    currency_id     UUID NOT NULL REFERENCES currencies(id),
    default_language_id UUID NOT NULL REFERENCES languages(id),
    phone_code      VARCHAR(10),
    flag_emoji      VARCHAR(8),
    hreflang        VARCHAR(10),                            -- e.g. en-US
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_countries_active ON countries(is_active);

-- Add deferred FKs from users
ALTER TABLE users ADD CONSTRAINT fk_users_country FOREIGN KEY (country_id) REFERENCES countries(id);

-- =====================================================================
-- 3. CATALOG (Brands, Categories, Products, Specs, Variants, Tags)
-- =====================================================================
CREATE TABLE brands (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(120) NOT NULL,
    slug          CITEXT NOT NULL UNIQUE,
    logo_media_id UUID,
    description   TEXT,
    website_url   VARCHAR(255),
    country_id    UUID REFERENCES countries(id),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    product_count INTEGER NOT NULL DEFAULT 0,               -- denormalized counter
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_brands_slug ON brands(slug);

-- Self-referential categories cover Categories + Subcategories + Mega Menu
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id       UUID REFERENCES categories(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    slug            CITEXT NOT NULL,
    icon            VARCHAR(60),
    image_media_id  UUID,
    description     TEXT,
    path            LTREE,                                   -- materialized tree path for fast subtree queries
    depth           SMALLINT NOT NULL DEFAULT 0,
    position        INTEGER NOT NULL DEFAULT 0,
    show_in_menu    BOOLEAN NOT NULL DEFAULT TRUE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (parent_id, slug)
);
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE INDEX idx_categories_path ON categories USING GIST (path);
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- The specification dictionary: which spec keys exist per category
CREATE TABLE specification_groups (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(120) NOT NULL,                    -- "Display", "Camera", "Battery"
    position      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE specification_attributes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id      UUID REFERENCES specification_groups(id) ON DELETE SET NULL,
    key           VARCHAR(80) NOT NULL UNIQUE,              -- ram, storage, screen_size, battery_mah
    label         VARCHAR(120) NOT NULL,
    unit          VARCHAR(30),                              -- GB, mAh, inch
    data_type     VARCHAR(20) NOT NULL DEFAULT 'string' CHECK (data_type IN ('string','number','boolean','enum','range')),
    is_filterable BOOLEAN NOT NULL DEFAULT FALSE,           -- exposed as search facet
    is_comparable BOOLEAN NOT NULL DEFAULT TRUE,
    position      INTEGER NOT NULL DEFAULT 0
);

-- Which attributes apply to a category (drives dynamic spec forms + facets)
CREATE TABLE category_attributes (
    category_id   UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    attribute_id  UUID NOT NULL REFERENCES specification_attributes(id) ON DELETE CASCADE,
    PRIMARY KEY (category_id, attribute_id)
);

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    slug            CITEXT NOT NULL UNIQUE,
    brand_id        UUID NOT NULL REFERENCES brands(id),
    category_id     UUID NOT NULL REFERENCES categories(id),
    model_number    VARCHAR(120),
    short_desc      TEXT,
    description     TEXT,                                    -- rich HTML / MDX
    release_date    DATE,
    status          product_status NOT NULL DEFAULT 'draft',
    availability    availability_status NOT NULL DEFAULT 'in_stock',
    -- Flexible specs snapshot for fast reads (canonical source = product_specifications)
    specs           JSONB NOT NULL DEFAULT '{}'::jsonb,
    pros            TEXT[],
    cons            TEXT[],
    key_features    TEXT[],
    -- denormalized aggregates (maintained by triggers/jobs)
    rating_avg      NUMERIC(3,2) NOT NULL DEFAULT 0,
    rating_count    INTEGER NOT NULL DEFAULT 0,
    min_price_usd   NUMERIC(14,2),                           -- best price across stores, USD-normalized
    view_count      BIGINT NOT NULL DEFAULT 0,
    is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
    published_at    TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_products_brand     ON products(brand_id);
CREATE INDEX idx_products_category  ON products(category_id);
CREATE INDEX idx_products_status    ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_release   ON products(release_date DESC);
CREATE INDEX idx_products_specs_gin ON products USING GIN (specs);
CREATE INDEX idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);
CREATE INDEX idx_products_minprice  ON products(min_price_usd) WHERE deleted_at IS NULL;

-- Normalized, queryable specs (EAV) — canonical store; products.specs is a cache
CREATE TABLE product_specifications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_id  UUID NOT NULL REFERENCES specification_attributes(id),
    value_string  VARCHAR(255),
    value_number  NUMERIC(18,4),
    value_bool    BOOLEAN,
    UNIQUE (product_id, attribute_id)
);
CREATE INDEX idx_prodspec_attr_num ON product_specifications(attribute_id, value_number);

CREATE TABLE product_variants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name          VARCHAR(160) NOT NULL,                    -- "12GB/256GB - Phantom Black"
    sku           VARCHAR(120),
    attributes    JSONB NOT NULL DEFAULT '{}'::jsonb,       -- {ram:"12GB", storage:"256GB", color:"Black"}
    gtin          VARCHAR(14),                              -- EAN/UPC for schema.org
    image_media_id UUID,
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_variants_product ON product_variants(product_id);

CREATE TABLE tags (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(80) NOT NULL,
    slug          CITEXT NOT NULL UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE taggables (
    tag_id        UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    taggable_type VARCHAR(40) NOT NULL,                     -- 'product' | 'article'
    taggable_id   UUID NOT NULL,
    PRIMARY KEY (tag_id, taggable_type, taggable_id)
);
CREATE INDEX idx_taggables_target ON taggables(taggable_type, taggable_id);

-- Related/similar products (manual + ML-populated)
CREATE TABLE product_relations (
    product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    related_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    relation      VARCHAR(20) NOT NULL DEFAULT 'related' CHECK (relation IN ('related','similar','accessory','successor')),
    score         NUMERIC(5,4) DEFAULT 0,
    PRIMARY KEY (product_id, related_id, relation)
);

-- =====================================================================
-- 4. MEDIA LIBRARY
-- =====================================================================
CREATE TABLE media (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disk          VARCHAR(20) NOT NULL DEFAULT 's3',
    path          TEXT NOT NULL,                            -- s3 key
    url           TEXT NOT NULL,                            -- CDN url
    filename      VARCHAR(255) NOT NULL,
    mime_type     VARCHAR(100) NOT NULL,
    size_bytes    BIGINT NOT NULL,
    width         INTEGER,
    height        INTEGER,
    alt_text      VARCHAR(255),
    title         VARCHAR(255),
    blurhash      VARCHAR(64),                              -- LQIP placeholder
    folder        VARCHAR(255),
    variants      JSONB DEFAULT '{}'::jsonb,                -- {thumb:url, webp:url, avif:url}
    uploaded_by   UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_folder ON media(folder);

-- Polymorphic media attachments (product gallery, brand logo, etc.)
CREATE TABLE mediables (
    media_id      UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    mediable_type VARCHAR(40) NOT NULL,
    mediable_id   UUID NOT NULL,
    collection    VARCHAR(40) NOT NULL DEFAULT 'gallery',   -- gallery | featured | logo
    position      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (media_id, mediable_type, mediable_id, collection)
);
CREATE INDEX idx_mediables_target ON mediables(mediable_type, mediable_id, collection);

-- deferred media FKs
ALTER TABLE users   ADD CONSTRAINT fk_users_avatar  FOREIGN KEY (avatar_media_id) REFERENCES media(id);
ALTER TABLE brands  ADD CONSTRAINT fk_brands_logo   FOREIGN KEY (logo_media_id)   REFERENCES media(id);
ALTER TABLE categories ADD CONSTRAINT fk_cat_image  FOREIGN KEY (image_media_id)  REFERENCES media(id);

-- =====================================================================
-- 5. COMMERCE (Stores, Prices, Price History, Affiliate)
-- =====================================================================
CREATE TABLE stores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(120) NOT NULL,                  -- Amazon, AliExpress, Walmart, BestBuy, eBay
    slug            CITEXT NOT NULL UNIQUE,
    logo_media_id   UUID REFERENCES media(id),
    website_url     VARCHAR(255),
    affiliate_network VARCHAR(60),                          -- amazon_pa, cj, awin, impact, custom
    base_affiliate_tag VARCHAR(120),
    deeplink_template TEXT,                                  -- https://...{url}?tag={tag}&subid={subid}
    commission_rate NUMERIC(5,2),                            -- % default
    rating          NUMERIC(3,2),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-country store presence
CREATE TABLE store_countries (
    store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    country_id    UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    PRIMARY KEY (store_id, country_id)
);

-- Current price per product/variant/store/country
CREATE TABLE prices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id      UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    store_id        UUID NOT NULL REFERENCES stores(id),
    country_id      UUID NOT NULL REFERENCES countries(id),
    currency_id     UUID NOT NULL REFERENCES currencies(id),
    price           NUMERIC(14,2) NOT NULL,                 -- merchant native currency
    list_price      NUMERIC(14,2),                          -- MSRP / strikethrough
    price_usd       NUMERIC(14,2) NOT NULL,                 -- normalized for sort/compare
    availability    availability_status NOT NULL DEFAULT 'in_stock',
    shipping_cost   NUMERIC(14,2),
    coupon_code     VARCHAR(60),
    affiliate_link_id UUID,                                  -- FK added below
    product_url     TEXT,                                    -- canonical merchant URL
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, variant_id, store_id, country_id)
);
CREATE INDEX idx_prices_product_country ON prices(product_id, country_id, price_usd);
CREATE INDEX idx_prices_store ON prices(store_id);

-- Append-only price history, partitioned monthly (millions of rows)
CREATE TABLE price_history (
    id            BIGSERIAL,
    product_id    UUID NOT NULL,
    variant_id    UUID,
    store_id      UUID NOT NULL,
    country_id    UUID NOT NULL,
    price         NUMERIC(14,2) NOT NULL,
    price_usd     NUMERIC(14,2) NOT NULL,
    availability  availability_status NOT NULL,
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);
-- Example partitions (created/rotated by a maintenance job)
CREATE TABLE price_history_2026_06 PARTITION OF price_history
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE price_history_2026_07 PARTITION OF price_history
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE INDEX idx_pricehist_product ON price_history(product_id, recorded_at DESC);

CREATE TABLE affiliate_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id        UUID NOT NULL REFERENCES stores(id),
    product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
    country_id      UUID REFERENCES countries(id),
    label           VARCHAR(160),
    target_url      TEXT NOT NULL,                          -- final merchant URL (pre-tagging)
    affiliate_tag   VARCHAR(120),
    sub_id          VARCHAR(120),                           -- attribution sub-id
    short_code      VARCHAR(20) UNIQUE,                     -- /go/{short_code}
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_afflinks_product ON affiliate_links(product_id);
ALTER TABLE prices ADD CONSTRAINT fk_prices_afflink FOREIGN KEY (affiliate_link_id) REFERENCES affiliate_links(id);

-- High-volume click events (partition monthly or offload to ClickHouse)
CREATE TABLE affiliate_clicks (
    id              BIGSERIAL,
    affiliate_link_id UUID NOT NULL,
    product_id      UUID,
    store_id        UUID,
    country_id      UUID,
    user_id         UUID,
    session_id      VARCHAR(64),
    device          device_target NOT NULL DEFAULT 'all',
    referrer        TEXT,
    ip_hash         VARCHAR(64),                            -- hashed for privacy
    user_agent      TEXT,
    revenue_usd     NUMERIC(14,4) DEFAULT 0,                -- filled on postback/conversion
    converted       BOOLEAN NOT NULL DEFAULT FALSE,
    clicked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, clicked_at)
) PARTITION BY RANGE (clicked_at);
CREATE TABLE affiliate_clicks_2026_06 PARTITION OF affiliate_clicks
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE INDEX idx_clicks_link ON affiliate_clicks(affiliate_link_id, clicked_at DESC);

-- =====================================================================
-- 6. REVIEWS & RATINGS
-- =====================================================================
CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    author_name     VARCHAR(120),                           -- for guest/expert byline
    type            review_type NOT NULL DEFAULT 'user',
    title           VARCHAR(200),
    body            TEXT,
    rating          NUMERIC(3,2) NOT NULL CHECK (rating BETWEEN 0 AND 10),
    pros            TEXT[],
    cons            TEXT[],
    verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    helpful_count   INTEGER NOT NULL DEFAULT 0,
    status          moderation_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_product ON reviews(product_id, status);

-- Multi-criteria expert rating breakdown (design, performance, camera, battery, value)
CREATE TABLE rating_criteria (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id     UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    criterion     VARCHAR(60) NOT NULL,
    score         NUMERIC(3,2) NOT NULL
);

-- =====================================================================
-- 7. CONTENT (Articles, Pages, Menus, Layout)
-- =====================================================================
CREATE TABLE articles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(20) NOT NULL DEFAULT 'post' CHECK (type IN ('post','news','review','buying_guide','deal')),
    title           VARCHAR(255) NOT NULL,
    slug            CITEXT NOT NULL UNIQUE,
    excerpt         TEXT,
    body            TEXT,                                    -- MDX/HTML
    cover_media_id  UUID REFERENCES media(id),
    author_id       UUID REFERENCES users(id),
    category_id     UUID REFERENCES categories(id),
    status          content_status NOT NULL DEFAULT 'draft',
    reading_minutes SMALLINT,
    view_count      BIGINT NOT NULL DEFAULT 0,
    published_at    TIMESTAMPTZ,
    scheduled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_articles_status ON articles(status, published_at DESC);
CREATE INDEX idx_articles_type   ON articles(type);

-- Link products referenced inside articles / deals / buying guides
CREATE TABLE article_products (
    article_id    UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    position      INTEGER DEFAULT 0,
    PRIMARY KEY (article_id, product_id)
);

CREATE TABLE pages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(255) NOT NULL,
    slug            CITEXT NOT NULL UNIQUE,
    body            TEXT,
    layout_id       UUID,                                    -- FK to layouts (builder)
    status          content_status NOT NULL DEFAULT 'draft',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menus (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(80) NOT NULL,
    location      VARCHAR(40) NOT NULL UNIQUE,              -- main, mobile, footer
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menu_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id       UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    parent_id     UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    label         VARCHAR(120) NOT NULL,
    url           TEXT,
    link_type     VARCHAR(20) DEFAULT 'custom' CHECK (link_type IN ('custom','category','brand','product','page','article')),
    link_ref_id   UUID,                                      -- referenced entity id
    icon          VARCHAR(60),
    target        VARCHAR(10) DEFAULT '_self',
    position      INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_menuitems_menu ON menu_items(menu_id, parent_id, position);

-- Visual layout builder: a layout = ordered tree of blocks (JSONB props)
CREATE TABLE layouts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(120) NOT NULL,
    type          VARCHAR(30) NOT NULL CHECK (type IN ('header','footer','homepage','sidebar','landing')),
    is_active     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE layout_blocks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_id     UUID NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
    parent_id     UUID REFERENCES layout_blocks(id) ON DELETE CASCADE,
    block_type    VARCHAR(60) NOT NULL,                     -- hero, product_carousel, deals_grid, banner...
    props         JSONB NOT NULL DEFAULT '{}'::jsonb,       -- component config
    position      INTEGER NOT NULL DEFAULT 0,
    is_visible    BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_layoutblocks_layout ON layout_blocks(layout_id, parent_id, position);
ALTER TABLE pages ADD CONSTRAINT fk_pages_layout FOREIGN KEY (layout_id) REFERENCES layouts(id);

-- =====================================================================
-- 8. ADVERTISEMENTS
-- =====================================================================
CREATE TABLE ad_slots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(120) NOT NULL,
    placement     ad_placement NOT NULL,
    device        device_target NOT NULL DEFAULT 'all',
    dimensions    VARCHAR(20),                              -- 728x90, 300x250, responsive
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE advertisements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id         UUID NOT NULL REFERENCES ad_slots(id) ON DELETE CASCADE,
    name            VARCHAR(160) NOT NULL,
    type            ad_type NOT NULL,
    -- network/code-based ads
    network_code    TEXT,                                    -- AdSense/GAM slot id or AFS config
    custom_html     TEXT,                                    -- custom/affiliate banner markup
    image_media_id  UUID REFERENCES media(id),
    target_url      TEXT,
    -- targeting
    country_id      UUID REFERENCES countries(id),           -- null = all countries
    category_id     UUID REFERENCES categories(id),
    device          device_target NOT NULL DEFAULT 'all',
    -- scheduling & priority
    priority        SMALLINT NOT NULL DEFAULT 0,
    starts_at       TIMESTAMPTZ,
    ends_at         TIMESTAMPTZ,
    impression_count BIGINT NOT NULL DEFAULT 0,
    click_count     BIGINT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ads_slot_active ON advertisements(slot_id, is_active);
CREATE INDEX idx_ads_targeting ON advertisements(country_id, category_id, device);

-- =====================================================================
-- 9. SEO, SCHEMA, REDIRECTS
-- =====================================================================
-- Polymorphic SEO metadata for any entity (product, article, page, category, brand)
CREATE TABLE seo_metadata (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     VARCHAR(40) NOT NULL,
    entity_id       UUID NOT NULL,
    language_id     UUID REFERENCES languages(id),
    meta_title      VARCHAR(255),
    meta_description VARCHAR(500),
    canonical_url   TEXT,
    robots          VARCHAR(60) DEFAULT 'index,follow',
    og_title        VARCHAR(255),
    og_description  VARCHAR(500),
    og_image_media_id UUID REFERENCES media(id),
    og_type         VARCHAR(40) DEFAULT 'website',
    twitter_card    VARCHAR(40) DEFAULT 'summary_large_image',
    twitter_title   VARCHAR(255),
    twitter_description VARCHAR(500),
    focus_keyword   VARCHAR(120),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (entity_type, entity_id, language_id)
);
CREATE INDEX idx_seo_entity ON seo_metadata(entity_type, entity_id);

-- Hreflang alternates per entity/locale
CREATE TABLE seo_hreflangs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type   VARCHAR(40) NOT NULL,
    entity_id     UUID NOT NULL,
    hreflang      VARCHAR(10) NOT NULL,                     -- en-US, bn-BD, x-default
    url           TEXT NOT NULL,
    UNIQUE (entity_type, entity_id, hreflang)
);

-- Stored/overridable JSON-LD blocks
CREATE TABLE schema_data (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type   VARCHAR(40) NOT NULL,
    entity_id     UUID NOT NULL,
    schema_type   VARCHAR(60) NOT NULL,                     -- Product, Review, FAQPage, BreadcrumbList...
    json_ld       JSONB NOT NULL,
    auto_generated BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (entity_type, entity_id, schema_type)
);
CREATE INDEX idx_schema_entity ON schema_data(entity_type, entity_id);

CREATE TABLE redirects (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_path     TEXT NOT NULL UNIQUE,
    to_path       TEXT NOT NULL,
    type          redirect_type NOT NULL DEFAULT '301',
    hits          BIGINT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_redirects_from ON redirects(from_path) WHERE is_active;

-- =====================================================================
-- 10. PLATFORM (Settings, Notifications, Activity Logs, Translations)
-- =====================================================================
CREATE TABLE settings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name    VARCHAR(60) NOT NULL,                     -- general, seo, ads, mail, social
    key           VARCHAR(120) NOT NULL,
    value         JSONB,
    is_public     BOOLEAN NOT NULL DEFAULT FALSE,           -- exposed to frontend config
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (group_name, key)
);

CREATE TABLE notifications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
    channel       notification_channel NOT NULL DEFAULT 'in_app',
    type          VARCHAR(80) NOT NULL,                     -- price_drop, review_approved, system
    title         VARCHAR(200) NOT NULL,
    body          TEXT,
    data          JSONB DEFAULT '{}'::jsonb,
    read_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON notifications(user_id, read_at);

-- Price-drop watchlist (powers notifications)
CREATE TABLE price_alerts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    country_id    UUID REFERENCES countries(id),
    target_price_usd NUMERIC(14,2),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, product_id, country_id)
);

CREATE TABLE activity_logs (
    id            BIGSERIAL PRIMARY KEY,
    user_id       UUID REFERENCES users(id),
    action        VARCHAR(80) NOT NULL,                     -- created, updated, deleted, login
    subject_type  VARCHAR(40),
    subject_id    UUID,
    changes       JSONB,                                    -- {before:{}, after:{}}
    ip            INET,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_subject ON activity_logs(subject_type, subject_id);
CREATE INDEX idx_activity_user ON activity_logs(user_id, created_at DESC);

-- Generic translations table for any localizable field
CREATE TABLE translations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language_id   UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    entity_type   VARCHAR(40) NOT NULL,
    entity_id     UUID NOT NULL,
    field         VARCHAR(60) NOT NULL,
    value         TEXT,
    UNIQUE (language_id, entity_type, entity_id, field)
);
CREATE INDEX idx_translations_entity ON translations(entity_type, entity_id);

-- =====================================================================
-- TRIGGERS: auto-update updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name='updated_at' AND table_schema='public'
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

-- =====================================================================
-- END SCHEMA
-- =====================================================================
