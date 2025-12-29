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

    return {
      name: name && name.length > 0 ? name : undefined,
      email,
      jobRole: jobRole && jobRole.length > 0 ? jobRole : undefined
    };
  })
  .pipe(
    z.object({
      name: z.string().min(1).max(100).optional(),
      email: z.string().email().max(254),
      jobRole: z.string().min(1).max(100).optional()
    })
  );

export type SubscribePayload = z.infer<typeof SubscribePayloadSchema>;


