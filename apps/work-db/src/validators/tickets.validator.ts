import { z } from "zod";

export const createTicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  doneWork: z.string().min(1),
  date: z.string().min(1),
  interestingFacts: z.string().nullish(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const ticketIdSchema = z.coerce.number().int().positive();
