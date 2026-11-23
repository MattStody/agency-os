import { CheckCircle2, Inbox } from "lucide-react";
import type { ModuleManifest } from "../types";

/** Per-client approvals, under the client switcher. */
export const approvalsModule: ModuleManifest = {
  id: "approvals",
  name: "Approvals",
  description: "One queue for client sign-off on Meta ads and video clips/reels.",
  icon: CheckCircle2,
  scope: "client",
  section: "workspace",
  status: "live",
  requires: "approvals.view",
  order: 10,
};

/** Boldly's cross-client view of everything awaiting a decision. */
export const approvalsQueueModule: ModuleManifest = {
  id: "approvals-queue",
  name: "Approvals queue",
  description: "Every open approval across all clients.",
  icon: Inbox,
  scope: "global",
  section: "tools",
  status: "live",
  requires: "approvals.manage",
  path: "tools/approvals",
  order: 0,
};
