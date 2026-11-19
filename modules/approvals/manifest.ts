import { CheckCircle2 } from "lucide-react";
import type { ModuleManifest } from "../types";

export const approvalsModule: ModuleManifest = {
  id: "approvals",
  name: "Approvals",
  description: "One queue for client sign-off on Meta ads and video clips/reels.",
  icon: CheckCircle2,
  scope: "client",
  section: "workspace",
  status: "planned",
  requires: "approvals.view",
  order: 10,
};
