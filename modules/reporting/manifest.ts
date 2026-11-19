import { LineChart } from "lucide-react";
import type { ModuleManifest } from "../types";

export const reportingModule: ModuleManifest = {
  id: "reporting",
  name: "Reporting",
  description: "Monthly performance reports per client. Parked until the data source is decided.",
  icon: LineChart,
  scope: "client",
  section: "workspace",
  status: "planned",
  requires: "clients.view",
  order: 20,
};
