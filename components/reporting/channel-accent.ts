/**
 * Channel accent colours. `cls` comes from reporting.channels, so adding a
 * channel is a seed row plus one entry here — no template changes.
 */
const ACCENTS: Record<string, string> = {
  google: "bg-blue-500",
  meta: "bg-indigo-500",
  ga4: "bg-amber-500",
  gsc: "bg-teal-500",
  calls: "bg-rose-500",
  neutral: "bg-muted-foreground",
};

export function channelAccent(cls: string): string {
  return ACCENTS[cls] ?? ACCENTS.neutral;
}
