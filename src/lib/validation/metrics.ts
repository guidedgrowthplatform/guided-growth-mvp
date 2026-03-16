import { z } from 'zod';

export const metricCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  question: z.string(),
  input_type: z.enum(['binary', 'numeric', 'short_text', 'text']),
  frequency: z.enum(['daily', 'weekdays', 'weekends', 'weekly']),
});
export type MetricCreateForm = z.infer<typeof metricCreateSchema>;

export const metricFormSchema = metricCreateSchema.extend({
  active: z.boolean(),
  target_value: z.string(),
  target_unit: z.string(),
});
export type MetricFormData = z.infer<typeof metricFormSchema>;
