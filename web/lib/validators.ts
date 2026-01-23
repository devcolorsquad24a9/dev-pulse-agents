import { z } from "zod";

// SECURITY (workspace rule: validate/sanitize all external input):
// This schema is applied to user-provided form data before any DB calls.
export const SubscribePayloadSchema = z
  .object({
    name: z.string().optional(),
    email: z.string(),
    jobRole: z.string().optional()
  })
  .transform((raw) => {
    const name = typeof raw.name === "string" ? raw.name.trim() : undefined;
    const jobRole = typeof raw.jobRole === "string" ? raw.jobRole.trim() : undefined;
    const email = raw.email.trim().toLowerCase();

    const result = {
      name: name && name.length > 0 ? name : undefined,
      email,
      jobRole: jobRole && jobRole.length > 0 ? jobRole : undefined
    };

    // Validate transformed values
    if (result.name && (result.name.length < 1 || result.name.length > 100)) {
      throw new Error("Name must be between 1 and 100 characters");
    }
    if (!result.email || !z.string().email().safeParse(result.email).success || result.email.length > 254) {
      throw new Error("Invalid email address");
    }
    if (result.jobRole && (result.jobRole.length < 1 || result.jobRole.length > 100)) {
      throw new Error("Job role must be between 1 and 100 characters");
    }

    return result;
  });

export type SubscribePayload = z.infer<typeof SubscribePayloadSchema>;


