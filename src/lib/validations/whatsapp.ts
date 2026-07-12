import { z } from "zod";

export const whatsappConnectSchema = z.object({
  phoneNumberId: z.string().min(1, "Phone number ID is required"),
  whatsappBusinessAccountId: z
    .string()
    .min(1, "Business account ID is required"),
  accessToken: z.string().min(20, "Access token is required"),
});
