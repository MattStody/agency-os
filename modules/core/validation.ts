import { z } from "zod";
import { CHANNELS, CLIENT_STATUSES } from "@/lib/db/schema";

const optionalText = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const SERVICE_OPTIONS = [
  "Paid search",
  "Paid social",
  "SEO",
  "Content",
  "Video & podcast",
  "Web",
  "Email",
  "PR & communications",
  "Brand",
  "Analytics",
] as const;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens.")
  .max(60);

export const clientInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  slug: slugSchema,
  legalName: optionalText,
  website: optionalText,
  industry: optionalText,
  city: optionalText,
  status: z.enum(CLIENT_STATUSES).default("active"),
  services: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  timezone: z.string().trim().min(1).max(60).default("America/Toronto"),
  currency: z.string().trim().length(3).toUpperCase().default("CAD"),
  notes: z.string().trim().max(5000).transform((v) => (v === "" ? null : v)).nullable().optional(),
  crmRef: optionalText,
});
export type ClientInput = z.input<typeof clientInputSchema>;

export const channelInputSchema = z.object({
  channel: z.enum(CHANNELS),
  externalAccountId: z.string().trim().min(1, "Account ID is required.").max(120),
  label: optionalText,
});
export type ChannelInput = z.input<typeof channelInputSchema>;

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z
    .union([z.literal(""), z.email("Enter a valid email.")])
    .transform((v) => (v === "" ? null : v.toLowerCase()))
    .nullable()
    .optional(),
  phone: optionalText,
  title: optionalText,
  isPrimary: z.boolean().default(false),
  isApprover: z.boolean().default(false),
});
export type ContactInput = z.input<typeof contactInputSchema>;

export const inviteInputSchema = z.object({
  email: z.email("Enter a valid email.").transform((v) => v.toLowerCase()),
  name: optionalText,
  title: optionalText,
  role: z.enum(["admin", "team"]),
});
export type InviteInput = z.input<typeof inviteInputSchema>;

export const CHANNEL_LABELS: Record<(typeof CHANNELS)[number], string> = {
  google_ads: "Google Ads",
  meta: "Meta",
  ga4: "GA4",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  other: "Other",
};
