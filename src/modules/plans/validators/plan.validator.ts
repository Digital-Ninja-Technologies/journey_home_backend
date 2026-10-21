import { z } from "zod";

export const CreatePlanValidator = z.object({
  packageId: z.string().min(1),
  coveredPerson: z
    .object({
      fullName: z.string().trim().min(2),
      dateOfBirth: z.string().datetime().optional(),
      age: z.number().int().min(0).optional(),
      gender: z.string().trim().optional(),
      relationship: z.string().trim().min(2),
      address: z.string().trim().min(5),
      phoneNumber: z.string().trim().optional(),
    })
    .refine((value) => value.dateOfBirth || value.age !== undefined, {
      message: "Either dateOfBirth or age is required",
    }),
});
export type CreatePlanDto = z.infer<typeof CreatePlanValidator>;

export const AdminStatusValidator = z.object({
  status: z.enum([
    "Paused",
    "Service_Request",
    "Under_Review",
    "Approved",
    "Service_Scheduled",
    "Completed",
    "Cancelled",
    "Expired",
  ]),
});
