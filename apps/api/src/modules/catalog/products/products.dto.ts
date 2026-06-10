import { z } from 'zod';

const slug = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase, hyphenated slug');

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug,
  brandId: z.string().uuid(),
  categoryId: z.string().uuid(),
  modelNumber: z.string().max(120).optional(),
  shortDesc: z.string().optional(),
  description: z.string().optional(),
  releaseDate: z.coerce.date().optional(),
  status: z.enum(['draft', 'published', 'archived', 'scheduled']).default('draft'),
  availability: z
    .enum(['in_stock', 'out_of_stock', 'preorder', 'discontinued', 'coming_soon'])
    .default('in_stock'),
  specs: z.record(z.unknown()).default({}),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  keyFeatures: z.array(z.string()).default([]),
  isFeatured: z.boolean().default(false),
});
export type CreateProductDto = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
