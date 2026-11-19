import { ListChecks } from "lucide-react";
import type { ModuleManifest } from "../types";

export const tasksModule: ModuleManifest = {
  id: "tasks",
  name: "Tasks & projects",
  description: "Task and project tracking across clients.",
  icon: ListChecks,
  scope: "global",
  section: "tools",
  status: "planned",
  requires: "tools.use",
  order: 10,
};
