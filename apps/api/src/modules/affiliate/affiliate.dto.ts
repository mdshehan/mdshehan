import { z } from 'zod';

export const createAffiliateLinkSchema = z.object({
  storeId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  countryId: z.string().uuid().optional(),
  label: z.string().max(160).optional(),
  targetUrl: z.string().url(),
  affiliateTag: z.string().max(120).optional(),
  subId: z.string().max(120).optional(),
  shortCode: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  isActive: z.boolean().default(true),
});
export type CreateAffiliateLinkDto = z.infer<typeof createAffiliateLinkSchema>;

export const updateAffiliateLinkSchema = createAffiliateLinkSchema.partial();
export type UpdateAffiliateLinkDto = z.infer<typeof updateAffiliateLinkSchema>;
