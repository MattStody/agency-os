import { Receipt } from "lucide-react";
import type { ModuleManifest } from "../types";

export const invoicingModule: ModuleManifest = {
  id: "invoicing",
  name: "Invoicing",
  description: "Hooks into the accounting system for retainers and billable work.",
  icon: Receipt,
  scope: "global",
  section: "tools",
  status: "planned",
  requires: "team.manage",
  order: 20,
};
