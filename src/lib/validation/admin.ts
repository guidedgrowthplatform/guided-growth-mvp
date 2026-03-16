import { z } from 'zod';

export const allowlistSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  note: z.string(),
});
export type AllowlistForm = z.infer<typeof allowlistSchema>;
