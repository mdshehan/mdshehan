import { z } from 'zod';

export const createBrandSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase, hyphenated slug'),
  description: z.string().optional(),
  websiteUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
});
export type CreateBrandDto = z.infer<typeof createBrandSchema>;

export const updateBrandSchema = createBrandSchema.partial();
export type UpdateBrandDto = z.infer<typeof updateBrandSchema>;
