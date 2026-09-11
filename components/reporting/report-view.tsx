import { formatMetric } from "@/lib/reporting/format";
import type { CampaignRow } from "@/lib/reporting/report";
import type { ReportData } from "@/lib/reporting/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricDelta } from "./metric-delta";
import { channelAccent } from "./channel-accent";

/**
 * The branded, server-rendered report. Consumes the data contract exactly as
 * documented — anything it shows has to come from the normalized store, never
 * from an ad-hoc query in the page.
 */
export function ReportView({
  report,
  campaigns,
  brandColor,
  logoUrl,
}: {
  report: ReportData;
  campaigns: CampaignRow[];
  brandColor?: string;
  logoUrl?: string;
}) {
  return (
    <article className="space-y-8">
      <header
        className="rounded-lg border p-6 print:border-0"
        style={brandColor ? { borderTopWidth: 4, borderTopColor: brandColor } : undefined}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{report.client}</h1>
            <p className="text-sm text-muted-foreground">{report.subtitle}</p>
          </div>
          <div className="text-right">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={report.client} className="h-10 w-auto" />
            ) : null}
            <p className="text-sm font-medium">{report.period_label}</p>
            <p className="text-xs text-muted-foreground">{report.compare_label}</p>
          </div>
        </div>
      </header>

      <section aria-labelledby="kpis" className="space-y-3">
        <h2 id="kpis" className="text-sm font-medium text-muted-foreground">
          Headline metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {report.kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-semibold tabular-nums">
                  {formatMetric(kpi.value, kpi.format)}
                </p>
                <div className="flex items-baseline gap-2">
                  <MetricDelta
                    value={kpi.value}
                    prev={kpi.prev}
                    lowerIsBetter={kpi.lower_is_better}
                  />
                  <span className="text-xs text-muted-foreground">
                    prev {formatMetric(kpi.prev, kpi.format)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="channels" className="space-y-3">
        <h2 id="channels" className="text-sm font-medium text-muted-foreground">
          By channel
        </h2>
        {report.channels.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Channel</th>
                  <th className="px-4 py-2 text-right font-medium">Spend</th>
                  <th className="px-4 py-2 text-right font-medium">Clicks</th>
                  <th className="px-4 py-2 text-right font-medium">Conversions</th>
                  <th className="px-4 py-2 text-right font-medium">CPA</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.channels.map((channel) => {
                  const cpa = channel.conversions ? channel.spend / channel.conversions : null;
                  const prevCpa =
                    channel.prev?.conversions
                      ? channel.prev.spend / channel.prev.conversions
                      : null;
                  return (
                    <tr key={channel.name}>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            className={`h-2 w-2 rounded-full ${channelAccent(channel.cls)}`}
                            aria-hidden
                          />
                          {channel.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMetric(channel.spend, "money")}
                        <Trend value={channel.spend} prev={channel.prev?.spend ?? null} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMetric(channel.clicks, "int")}
                        <Trend value={channel.clicks} prev={channel.prev?.clicks ?? null} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMetric(channel.conversions, "number")}
                        <Trend
                          value={channel.conversions}
                          prev={channel.prev?.conversions ?? null}
                        />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMetric(cpa, "money")}
                        <Trend value={cpa} prev={prevCpa} lowerIsBetter />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {campaigns.length > 0 && (
        <section aria-labelledby="campaigns" className="space-y-3">
          <h2 id="campaigns" className="text-sm font-medium text-muted-foreground">
            Campaign detail
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Campaign</th>
                  <th className="px-4 py-2 font-medium">Channel</th>
                  <th className="px-4 py-2 text-right font-medium">Spend</th>
                  <th className="px-4 py-2 text-right font-medium">Impr.</th>
                  <th className="px-4 py-2 text-right font-medium">Clicks</th>
                  <th className="px-4 py-2 text-right font-medium">Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {campaigns.map((campaign) => (
                  <tr key={`${campaign.channel}-${campaign.campaign}`}>
                    <td className="px-4 py-2">{campaign.campaign}</td>
                    <td className="px-4 py-2 text-muted-foreground">{campaign.channel}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMetric(campaign.spend, "money")}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMetric(campaign.impressions, "int")}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMetric(campaign.clicks, "int")}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMetric(campaign.conversions, "number")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </article>
  );
}

function Trend({
  value,
  prev,
  lowerIsBetter,
}: {
  value: number | null;
  prev: number | null;
  lowerIsBetter?: boolean;
}) {
  return (
    <MetricDelta
      value={value}
      prev={prev}
      lowerIsBetter={lowerIsBetter}
      className="ml-2"
    />
  );
}

function EmptyState() {
  return (
    <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      No performance data for this period yet. Run the sync
      (<code className="text-xs">/api/reporting/sync</code>) or pick another month.
    </p>
  );
}
