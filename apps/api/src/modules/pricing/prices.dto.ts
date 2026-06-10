import { z } from 'zod';

const availability = z.enum([
  'in_stock',
  'out_of_stock',
  'preorder',
  'discontinued',
  'coming_soon',
]);

export const createPriceSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  storeId: z.string().uuid(),
  countryId: z.string().uuid(),
  currencyId: z.string().uuid(),
  price: z.number().positive(),
  listPrice: z.number().positive().optional(),
  availability: availability.default('in_stock'),
  shippingCost: z.number().nonnegative().optional(),
  couponCode: z.string().max(60).optional(),
  affiliateLinkId: z.string().uuid().optional(),
  productUrl: z.string().url().optional(),
});
export type CreatePriceDto = z.infer<typeof createPriceSchema>;

export const updatePriceSchema = z.object({
  price: z.number().positive().optional(),
  listPrice: z.number().positive().optional(),
  availability: availability.optional(),
  shippingCost: z.number().nonnegative().optional(),
  couponCode: z.string().max(60).optional(),
  affiliateLinkId: z.string().uuid().optional(),
  productUrl: z.string().url().optional(),
});
export type UpdatePriceDto = z.infer<typeof updatePriceSchema>;
