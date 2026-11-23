import { ArrowLeft, Link2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetUploader } from "@/components/approvals/asset-uploader";
import { ClipPreview } from "@/components/approvals/clip-preview";
import { CommentThread } from "@/components/approvals/comment-thread";
import { DecisionForm, NewVersionForm, SendForm } from "@/components/approvals/decision-panel";
import { ApprovalHistory } from "@/components/approvals/history";
import { ApprovalStatusBadge, DueDate, formatBytes, TypeLabel } from "@/components/approvals/labels";
import { MetaAdPreview } from "@/components/approvals/meta-ad-preview";
import { PlayerProvider } from "@/components/approvals/player";
import { ActionButton } from "@/components/forms/action-button";
import { SectionTitle } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db/client";
import { can } from "@/lib/permissions";
import { requireClient } from "@/lib/shell";
import { cn } from "@/lib/utils";
import * as act from "@/modules/approvals/actions";
import { getItemDetail } from "@/modules/approvals/service";

export const metadata = { title: "Approval" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ApprovalItemPage({
  params,
  searchParams,
}: {
  params: { client: string; itemId: string };
  searchParams: { v?: string; t?: string };
}) {
  const { access, client } = await requireClient(params.client);
  if (!can(access, "approvals.view") || !UUID.test(params.itemId)) notFound();
  const d = await getItemDetail(getDb(), access, client.id, params.itemId).catch((e: Error) => {
    if (e.name === "NotFoundError" || e.name === "ForbiddenError") notFound();
    throw e;
  });
  const { item, current } = d;
  if (!current) notFound();

  const shown = d.versions.find((v) => String(v.versionNo) === searchParams.v) ?? current;
  const viewingOld = shown.id !== current.id;
  const manage = can(access, "approvals.manage");
  const internal = access.isInternal;
  const open = ["draft", "pending", "changes_requested"].includes(item.status);
  const bind = <A extends unknown[], R>(fn: (cid: string, slug: string, iid: string, ...a: A) => R) =>
    fn.bind(null, client.id, client.slug, item.id) as (...a: A) => R;

  const sendBlocker =
    current.assets.length === 0
      ? "Add at least one file first."
      : item.type === "clip" && !current.assets.some((a) => a.kind === "video")
        ? "A clip needs a video file."
        : item.type === "meta_ad" && !current.copy.primaryText && !current.copy.headline
          ? "Add the ad copy first (Edit details)."
          : null;

  return (
    <PlayerProvider initialTime={searchParams.t ? Number(searchParams.t) : undefined}>
      <Link
        href={`/c/${client.slug}/approvals`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Approvals
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <TypeLabel type={item.type} />
            <span className="text-xs text-muted-foreground">Version {current.versionNo}</span>
          </div>
          <h1 className="text-[30px] font-medium leading-tight text-brand-ink">{item.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <ApprovalStatusBadge status={item.status} clientView={!internal} />
            <span className="text-muted-foreground">
              Needed by <DueDate dueAt={item.dueAt} open={open} />
            </span>
            {item.sourceRef && internal && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" /> {item.sourceRef}
              </span>
            )}
          </div>
          {item.description && <p className="mt-3 max-w-2xl text-[15px] text-muted-foreground">{item.description}</p>}
        </div>
        {manage && (
          <div className="flex shrink-0 gap-2">
            {item.status !== "archived" && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/c/${client.slug}/approvals/${item.id}/edit`}>Edit details</Link>
              </Button>
            )}
            <ActionButton
              variant="ghost"
              size="sm"
              action={act.setArchivedAction.bind(null, client.id, client.slug, item.id, item.status !== "archived")}
              confirm={item.status !== "archived" ? "Archive this item? It leaves the queue but keeps its history." : undefined}
            >
              {item.status === "archived" ? "Restore" : "Archive"}
            </ActionButton>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Preview */}
        <section className="min-w-0">
          {d.versions.length > 1 && (
            <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Versions">
              {d.versions.map((v) => (
                <Link
                  key={v.id}
                  href={v.id === current.id ? "?" : `?v=${v.versionNo}`}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    v.id === shown.id ? "border-brand-ink bg-brand-ink text-brand-paper" : "bg-white hover:border-brand-sage"
                  )}
                >
                  v{v.versionNo}
                  {v.id === current.id ? " · current" : ""}
                </Link>
              ))}
            </nav>
          )}
          {viewingOld && (
            <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              You&rsquo;re viewing version {shown.versionNo}. <Link href="?" className="font-medium underline">Go to the current version</Link>
            </p>
          )}
          {shown.notes && (
            <p className="mb-4 rounded-md border bg-white px-3 py-2 text-sm">
              <span className="font-medium">What changed in v{shown.versionNo}:</span> {shown.notes}
            </p>
          )}

          <div className="rounded-2xl bg-[#E9E6DC] px-4 py-8 sm:px-8">
            {item.type === "meta_ad" ? (
              <MetaAdPreview pageName={client.name} copy={shown.copy} assets={shown.assets} />
            ) : (
              <ClipPreview assets={shown.assets} />
            )}
          </div>

          {shown.assets.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {shown.assets
                .map((a) =>
                  [a.originalName, a.width && a.height ? `${a.width}×${a.height}` : null, a.durationS ? `${a.durationS.toFixed(1)}s` : null, formatBytes(a.sizeBytes)]
                    .filter(Boolean)
                    .join(" · ")
                )
                .join("  —  ")}
            </p>
          )}

          {manage && item.status === "draft" && !viewingOld && (
            <div className="mt-6">
              <SectionTitle>Files for version {current.versionNo}</SectionTitle>
              <AssetUploader
                accept={item.type === "clip" ? "video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"}
                assets={current.assets}
                createUpload={act.createUploadAction.bind(null, client.id, item.id)}
                register={act.registerAssetAction.bind(null, client.id, client.slug, item.id)}
                removeActions={Object.fromEntries(
                  current.assets.map((a) => [a.id, act.removeAssetAction.bind(null, client.id, client.slug, item.id, a.id)])
                )}
              />
            </div>
          )}
        </section>

        {/* Side panel */}
        <aside className="space-y-6">
          <StatusCard>
            {item.status === "pending" && can(access, "approvals.decide") && (
              <>
                <CardTitle className="text-lg">{internal ? "Waiting on the client" : "Your decision"}</CardTitle>
                <DecisionForm action={bind(act.decideAction)} approvers={d.approvers} internal={internal} />
              </>
            )}
            {item.status === "draft" && manage && (
              <>
                <CardTitle className="text-lg">Ready to send?</CardTitle>
                <SendForm action={bind(act.sendForApprovalAction)} disabledReason={sendBlocker} />
              </>
            )}
            {(item.status === "changes_requested" || item.status === "approved") && (
              <>
                <CardTitle className="text-lg">{item.status === "approved" ? "Approved" : "Changes requested"}</CardTitle>
                <LatestDecision d={d.decisions.at(-1)} />
                {manage && <NewVersionForm action={bind(act.createVersionAction)} nextNo={current.versionNo + 1} />}
              </>
            )}
            {item.status === "archived" && (
              <p className="text-sm text-muted-foreground">Archived. Restore it to continue.</p>
            )}
          </StatusCard>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentThread
                comments={d.comments}
                shownVersionId={shown.id}
                shownVersionNo={shown.versionNo}
                addAction={bind(act.addCommentAction)}
                resolveActions={
                  manage
                    ? Object.fromEntries(d.comments.map((c) => [c.id, act.resolveCommentAction.bind(null, client.id, client.slug, item.id, c.id)]))
                    : undefined
                }
                canComment={item.status !== "archived"}
                isInternal={internal}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">History</CardTitle>
            </CardHeader>
            <CardContent>
              <ApprovalHistory versions={d.versions} decisions={d.decisions} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </PlayerProvider>
  );
}

function StatusCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border-brand-ink/15">
      <CardContent className="space-y-4 pt-6">{children}</CardContent>
    </Card>
  );
}

function LatestDecision({ d }: { d?: { userName: string | null; onBehalfOf: string | null; note: string | null; createdAt: Date } }) {
  if (!d) return null;
  const who = d.onBehalfOf ?? d.userName ?? "Client";
  return (
    <div className="rounded-md bg-brand-paper px-3 py-2.5 text-sm">
      <p className="font-medium text-brand-ink">{who}</p>
      {d.note && <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{d.note}</p>}
      <p className="mt-1 text-xs text-muted-foreground">
        {new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }).format(d.createdAt)}
      </p>
    </div>
  );
}
