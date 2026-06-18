import { z } from "zod";

export const CreateJobSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export type CreateJob = z.infer<typeof CreateJobSchema>;
