import * as z from "zod";

const registerPayload = z.object({
  first_name: z.string().min(1, {
    message: "First name is required",
  }).optional(),
  last_name: z.string().optional(),
  email: z.email({
    message: "Invalid email address",
  }).optional(),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters long",
  }).optional(),
  picture: z.string().nullish(),
  provider: z.string().min(1, {
    message: "Provider is required",
  }).default("email"),
  provider_token: z.string().nullish(),
});

export { registerPayload };
