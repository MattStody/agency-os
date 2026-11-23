import { z } from "zod";
import { APPROVAL_TYPES, DECISIONS } from "./schema";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const adCopySchema = z
  .object({
    primaryText: z.string().trim().max(3000).optional(),
    headline: z.string().trim().max(255).optional(),
    description: z.string().trim().max(255).optional(),
    cta: z.string().trim().max(40).optional(),
    url: z.union([z.literal(""), z.url("Enter a full URL, starting with https://")]).optional(),
  })
  .transform((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined && v !== "")));

export const itemInputSchema = z.object({
  type: z.enum(APPROVAL_TYPES),
  title: z.string().trim().min(1, "Give it a title.").max(160),
  description: optional(2000),
  dueAt: z
    .union([z.literal(""), z.iso.date("Use a valid date.")])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  sourceRef: optional(500),
  copy: adCopySchema.optional(),
});
export type ItemInput = z.input<typeof itemInputSchema>;

export const itemUpdateSchema = itemInputSchema.omit({ type: true });
export type ItemUpdate = z.input<typeof itemUpdateSchema>;

export const versionInputSchema = z.object({
  notes: optional(2000),
  copy: adCopySchema.optional(),
});
export type VersionInput = z.input<typeof versionInputSchema>;

export const commentInputSchema = z.object({
  body: z.string().trim().min(1, "Write a comment.").max(5000),
  timecodeS: z.number().min(0).max(60 * 60 * 6).nullable().optional(),
  isInternal: z.boolean().default(false),
  versionId: z.uuid().optional(),
});
export type CommentInput = z.input<typeof commentInputSchema>;

export const decisionInputSchema = z
  .object({
    decision: z.enum(DECISIONS),
    note: optional(5000),
    onBehalfOf: optional(160),
  })
  .refine((d) => d.decision !== "changes_requested" || !!d.note, {
    message: "Say what needs to change.",
    path: ["note"],
  });
export type DecisionInput = z.input<typeof decisionInputSchema>;

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;

export const uploadRequestSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string().refine((t) => t in IMAGE_TYPES || t in VIDEO_TYPES, "Use JPG, PNG, WebP, GIF, MP4, MOV or WebM."),
  size: z.number().int().positive(),
});
export type UploadRequest = z.input<typeof uploadRequestSchema>;

export const registerAssetSchema = z.object({
  key: z.string().min(1).max(512),
  name: z.string().trim().max(255).optional(),
  type: z.string(),
  size: z.number().int().positive(),
  width: z.number().int().positive().max(20000).nullable().optional(),
  height: z.number().int().positive().max(20000).nullable().optional(),
  durationS: z.number().min(0).max(60 * 60 * 6).nullable().optional(),
});
export type RegisterAssetInput = z.input<typeof registerAssetSchema>;

export const CTA_OPTIONS = [
  "Learn more",
  "Book now",
  "Sign up",
  "Shop now",
  "Contact us",
  "Get offer",
  "Register",
  "Apply now",
  "Download",
  "Watch more",
] as const;

export const STATUS_LABELS = {
  draft: "Draft",
  pending: "Awaiting client",
  changes_requested: "Changes requested",
  approved: "Approved",
  archived: "Archived",
} as const;

export const TYPE_LABELS = { meta_ad: "Meta ad", clip: "Clip / reel" } as const;
