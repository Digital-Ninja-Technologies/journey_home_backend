import { z } from "zod";

export const CreatePackageValidator = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().min(5),
  photographyIncluded: z.boolean(),
  videographyIncluded: z.boolean(),
  coverageDetails: z.string().trim().optional(),
  deliverables: z.array(z.string().trim().min(1)).default([]),
  monthlyContributionMinor: z.number().int().positive(),
  currency: z.string().trim().length(3).default("NGN"),
  isActive: z.boolean().optional(),
});

export const UpdatePackageValidator = CreatePackageValidator.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field is required",
);
