import { z } from "zod";

const e164ish = z
  .string()
  .min(8, "Phone number is required")
  .regex(/^\+?[1-9]\d{6,14}$/, "Use E.164 format, e.g. +15551234567");

export const twilioConnectSchema = z.object({
  accountSid: z
    .string()
    .min(10, "Account SID is required")
    .regex(/^AC[a-f0-9]{32}$/i, "Invalid Account SID (starts with AC)"),
  authToken: z.string().min(20, "Auth token is required"),
  smsPhoneNumber: e164ish,
  whatsappPhoneNumber: e164ish.optional().or(z.literal("")),
});
