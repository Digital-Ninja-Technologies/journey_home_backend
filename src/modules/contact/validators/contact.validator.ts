import { z } from "zod";
import { ContactTopic } from "../models/contact.model";

export const CreateContactSubmissionValidator = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(30),
  email: z.string().trim().email().max(254),
  topic: z.nativeEnum(ContactTopic),
  message: z.string().trim().min(5).max(5000),
});

export type CreateContactSubmissionDto = z.infer<typeof CreateContactSubmissionValidator>;
