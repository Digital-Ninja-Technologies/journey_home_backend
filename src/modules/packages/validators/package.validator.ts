import { z } from "zod";

export const CreatePackageValidator = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().min(5),

  features: z.array(z.string().trim().min(1)).default([]),
  amount: z.number().int().positive(),
  currency: z.string().trim().length(3).default("NGN"),
  billingInterval: z.enum(["monthly"]).default("monthly"),
  isActive: z.boolean().optional(),
});

export const UpdatePackageValidator = CreatePackageValidator.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field is required",
);
