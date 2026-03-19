import { z } from 'zod';

export const allowlistSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
  note: z.string(),
});
export type AllowlistForm = z.infer<typeof allowlistSchema>;
