/**
 * Seed: localization (currencies, languages, countries), RBAC (roles, permissions),
 * and a small demo catalog (brands, categories, specs, products, stores, prices)
 * so the API returns real data end-to-end immediately after `db:seed`.
 */
import { PrismaClient, ProductStatus, AvailabilityStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding…');

  // --- Currencies ---
  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$', usdRate: 1 },
    { code: 'EUR', name: 'Euro', symbol: '€', usdRate: 1.08 },
    { code: 'GBP', name: 'British Pound', symbol: '£', usdRate: 1.27 },
    { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', usdRate: 0.0091 },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', usdRate: 0.012 },
  ];
  for (const c of currencies) {
    await prisma.currency.upsert({ where: { code: c.code }, update: c, create: c });
  }
  const usd = await prisma.currency.findUniqueOrThrow({ where: { code: 'USD' } });

  // --- Languages ---
  const languages = [
    { code: 'en', name: 'English', nativeName: 'English', isDefault: true },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
  ];
  for (const l of languages) {
    await prisma.language.upsert({ where: { code: l.code }, update: l, create: l });
  }
  const en = await prisma.language.findUniqueOrThrow({ where: { code: 'en' } });

  // --- Countries ---
  const countries = [
    { iso2: 'US', iso3: 'USA', name: 'United States', hreflang: 'en-US', flagEmoji: '🇺🇸' },
    { iso2: 'GB', iso3: 'GBR', name: 'United Kingdom', hreflang: 'en-GB', flagEmoji: '🇬🇧' },
    { iso2: 'BD', iso3: 'BGD', name: 'Bangladesh', hreflang: 'bn-BD', flagEmoji: '🇧🇩' },
    { iso2: 'IN', iso3: 'IND', name: 'India', hreflang: 'en-IN', flagEmoji: '🇮🇳' },
  ];
  for (const c of countries) {
    await prisma.country.upsert({
      where: { iso2: c.iso2 },
      update: {},
      create: { ...c, currencyId: usd.id, defaultLanguageId: en.id },
    });
  }
  const us = await prisma.country.findUniqueOrThrow({ where: { iso2: 'US' } });

  // --- RBAC: roles + permissions ---
  const roleNames = [
    ['super_admin', 'Super Admin'],
    ['admin', 'Admin'],
    ['editor', 'Editor'],
    ['seo_manager', 'SEO Manager'],
    ['product_manager', 'Product Manager'],
    ['ad_manager', 'Ad Manager'],
    ['vendor_manager', 'Vendor Manager'],
  ];
  for (const [name, label] of roleNames) {
    await prisma.role.upsert({
      where: { name },
      update: { label },
      create: { name, label, isSystem: name === 'super_admin' },
    });
  }

  const groups = ['product', 'brand', 'category', 'content', 'ad', 'affiliate', 'seo', 'user', 'setting'];
  const actions = ['view', 'create', 'update', 'delete'];
  for (const g of groups) {
    for (const a of actions) {
      const name = `${g}.${a}`;
      await prisma.permission.upsert({
        where: { name },
        update: {},
        create: { name, groupName: g, description: `Can ${a} ${g}` },
      });
    }
  }
  // grant all permissions to super_admin
  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } });
  const allPerms = await prisma.permission.findMany();
  for (const p of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: p.id } },
      update: {},
      create: { roleId: superAdmin.id, permissionId: p.id },
    });
  }

  // --- Spec dictionary ---
  const displayGroup = await prisma.specificationGroup.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000d1' },
    update: {},
    create: { id: '00000000-0000-0000-0000-0000000000d1', name: 'Key Specs', position: 0 },
  });
  const attrDefs = [
    { key: 'ram', label: 'RAM', unit: 'GB', dataType: 'number', isFilterable: true },
    { key: 'storage', label: 'Storage', unit: 'GB', dataType: 'number', isFilterable: true },
    { key: 'screen_size', label: 'Screen Size', unit: 'inch', dataType: 'number', isFilterable: true },
    { key: 'battery_mah', label: 'Battery', unit: 'mAh', dataType: 'number', isFilterable: true },
    { key: 'chipset', label: 'Chipset', dataType: 'string', isFilterable: true },
  ];
  for (const a of attrDefs) {
    await prisma.specificationAttribute.upsert({
      where: { key: a.key },
      update: {},
      create: { ...a, groupId: displayGroup.id },
    });
  }

  // --- Categories (tree) ---
  const phones = await prisma.category.upsert({
    where: { parentId_slug: { parentId: null as unknown as string, slug: 'phones' } },
    update: {},
    create: { name: 'Smartphones', slug: 'phones', icon: 'smartphone', depth: 0, path: 'phones' },
  }).catch(async () =>
    // parentId null unique workaround: find or create
    (await prisma.category.findFirst({ where: { slug: 'phones', parentId: null } })) ??
    prisma.category.create({ data: { name: 'Smartphones', slug: 'phones', icon: 'smartphone', path: 'phones' } }),
  );

  // --- Brands ---
  const samsung = await prisma.brand.upsert({
    where: { slug: 'samsung' },
    update: {},
    create: { name: 'Samsung', slug: 'samsung', websiteUrl: 'https://samsung.com' },
  });
  const apple = await prisma.brand.upsert({
    where: { slug: 'apple' },
    update: {},
    create: { name: 'Apple', slug: 'apple', websiteUrl: 'https://apple.com' },
  });

  // --- Stores ---
  const amazon = await prisma.store.upsert({
    where: { slug: 'amazon' },
    update: {},
    create: { name: 'Amazon', slug: 'amazon', affiliateNetwork: 'amazon_pa', websiteUrl: 'https://amazon.com' },
  });
  const bestbuy = await prisma.store.upsert({
    where: { slug: 'bestbuy' },
    update: {},
    create: { name: 'BestBuy', slug: 'bestbuy', affiliateNetwork: 'impact', websiteUrl: 'https://bestbuy.com' },
  });

  // --- Products + prices ---
  const demoProducts = [
    {
      name: 'Samsung Galaxy S25 Ultra', slug: 'samsung-galaxy-s25-ultra', brandId: samsung.id,
      specs: { ram: 12, storage: 256, screen_size: 6.9, battery_mah: 5000, chipset: 'Snapdragon 8 Gen 4' },
      pros: ['Stunning display', '200MP camera', 'Long battery life'],
      cons: ['Expensive', 'Large size'], prices: [{ store: amazon.id, p: 1199 }, { store: bestbuy.id, p: 1219 }],
    },
    {
      name: 'Apple iPhone 16 Pro', slug: 'apple-iphone-16-pro', brandId: apple.id,
      specs: { ram: 8, storage: 256, screen_size: 6.3, battery_mah: 3582, chipset: 'A18 Pro' },
      pros: ['Best-in-class performance', 'Excellent cameras'],
      cons: ['Pricey', 'No always-on charger'], prices: [{ store: amazon.id, p: 999 }],
    },
  ];

  for (const dp of demoProducts) {
    const product = await prisma.product.upsert({
      where: { slug: dp.slug },
      update: {},
      create: {
        name: dp.name, slug: dp.slug, brandId: dp.brandId, categoryId: phones.id,
        status: ProductStatus.published, availability: AvailabilityStatus.in_stock,
        specs: dp.specs, pros: dp.pros, cons: dp.cons,
        keyFeatures: [], publishedAt: new Date(),
        minPriceUsd: Math.min(...dp.prices.map((x) => x.p)),
      },
    });
    for (const pr of dp.prices) {
      await prisma.price.upsert({
        where: {
          productId_variantId_storeId_countryId: {
            productId: product.id, variantId: null as unknown as string, storeId: pr.store, countryId: us.id,
          },
        },
        update: { price: pr.p, priceUsd: pr.p },
        create: {
          productId: product.id, storeId: pr.store, countryId: us.id, currencyId: usd.id,
          price: pr.p, priceUsd: pr.p, availability: AvailabilityStatus.in_stock,
        },
      });
    }
  }

  // --- Public settings ---
  for (const s of [
    { groupName: 'general', key: 'site_name', value: 'Global Gadget Price Hub', isPublic: true },
    { groupName: 'general', key: 'default_country', value: 'US', isPublic: true },
  ]) {
    await prisma.setting.upsert({
      where: { groupName_key: { groupName: s.groupName, key: s.key } },
      update: { value: s.value },
      create: s,
    });
  }

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
