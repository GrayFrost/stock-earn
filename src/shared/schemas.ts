import { z } from 'zod';

const decimal = z.string().trim().regex(/^\d+(?:\.\d+)?$/, '请输入有效的非负数');
const positiveDecimal = decimal.refine((value) => Number(value) > 0, '必须大于 0');

export const idSchema = z.string().uuid();
export const platformCreateSchema = z.object({ name: z.string().trim().min(1).max(60) });
export const platformUpdateSchema = platformCreateSchema.extend({ id: idSchema });
export const archiveSchema = z.object({ id: idSchema, archived: z.boolean() });
export const instrumentAddSchema = z.object({
  symbol: z.string().trim().min(1).max(16).regex(/^[A-Za-z0-9.\-]+$/).transform((value) => value.toUpperCase()),
  name: z.string().trim().max(100).optional(),
  exchange: z.string().trim().max(40).optional(),
});
export const instrumentUpdateSchema = z.object({ id: idSchema, name: z.string().trim().max(100), exchange: z.string().trim().max(40) });
export const tradeInputSchema = z.object({
  instrumentId: idSchema,
  platformId: idSchema,
  side: z.enum(['BUY', 'SELL']),
  quantity: positiveDecimal,
  unitPrice: positiveDecimal,
  fee: decimal,
  executedAt: z.string().datetime(),
  note: z.string().trim().max(500).optional().default(''),
});
export const tradeUpdateSchema = tradeInputSchema.extend({ id: idSchema });
export const tradePreviewSchema = tradeInputSchema.extend({ id: idSchema.optional() });
export const settingsUpdateSchema = z.object({
  startDate: z.string().date().optional(),
  colorMode: z.enum(['us', 'cn']).optional(),
  fontSize: z.enum(['base', 'comfortable', 'large', 'extra-large']).optional(),
  apiKey: z.string().trim().max(300).nullable().optional(),
  initialized: z.boolean().optional(),
});
