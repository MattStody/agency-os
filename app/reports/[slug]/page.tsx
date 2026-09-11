import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  availablePeriods,
  buildReport,
  getClientBySlug,
  loadCampaignDetail,
} from "@/lib/reporting/report";
import { isPeriodKey, latestClosedPeriod } from "@/lib/reporting/periods";
import { ReportView } from "@/components/reporting/report-view";
import { PeriodPicker } from "@/components/reporting/period-picker";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { period?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/reports/${params.slug}`);
  }

  const client = await getClientBySlug(params.slug);
  if (!client) notFound();

  const period = isPeriodKey(searchParams.period)
    ? searchParams.period
    : latestClosedPeriod().key;

  const [report, campaigns, periods] = await Promise.all([
    buildReport(client, period),
    loadCampaignDetail(client.id, period),
    availablePeriods(client.id),
  ]);

  // Always offer the selected month, even if it has no data yet.
  const options = [...new Set([period, ...periods])].sort().reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/reports"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All reports
        </Link>
        <PeriodPicker slug={client.slug} periods={options} selected={period} />
      </div>

      <ReportView
        report={report}
        campaigns={campaigns}
        brandColor={client.brand.primary_color}
        logoUrl={client.brand.logo_url}
      />
    </div>
  );
}
