import { DoorOpen } from "lucide-react";
import type { ModuleManifest } from "../types";

export const portalModule: ModuleManifest = {
  id: "portal",
  name: "Client portal",
  description: "Invite client users and preview what they see: their own reports and approvals only.",
  icon: DoorOpen,
  scope: "global",
  section: "admin",
  status: "planned",
  requires: "team.manage",
  order: 30,
};
