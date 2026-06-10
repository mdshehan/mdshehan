import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase, hyphenated slug'),
  parentId: z.string().uuid().optional(),
  icon: z.string().max(60).optional(),
  description: z.string().optional(),
  position: z.number().int().default(0),
  showInMenu: z.boolean().default(true),
  isActive: z.boolean().default(true),
});
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
