import { Globe, MoreHorizontal, ThumbsUp, MessageCircle, Share2 } from "lucide-react";
import type { AdCopy } from "@/modules/approvals/schema";
import type { AssetView } from "@/modules/approvals/service";
import { VideoPlayer } from "./player";

function domainOf(url?: string) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toUpperCase();
  } catch {
    return null;
  }
}

/** A Facebook/Instagram-feed style mock of the ad, for review. Not pixel-exact. */
export function MetaAdPreview({ pageName, copy, assets }: { pageName: string; copy: AdCopy; assets: AssetView[] }) {
  const initials = pageName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  const domain = domainOf(copy.url);
  const carousel = assets.length > 1;

  return (
    <div className="mx-auto w-full max-w-[440px] overflow-hidden rounded-xl border bg-white text-[14px] text-[#1c1e21] shadow-sm">
      <div className="flex items-center gap-2.5 px-3.5 pt-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-ink text-xs font-semibold text-brand-mint">
          {initials}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold">{pageName}</p>
          <p className="flex items-center gap-1 text-xs text-[#65676b]">
            Sponsored · <Globe className="h-3 w-3" />
          </p>
        </div>
        <MoreHorizontal className="h-5 w-5 text-[#65676b]" />
      </div>
      {copy.primaryText ? (
        <p className="whitespace-pre-line px-3.5 py-2.5 leading-snug">{copy.primaryText}</p>
      ) : (
        <p className="px-3.5 py-2.5 italic text-[#8a8d91]">Primary text not set</p>
      )}

      {assets.length === 0 ? (
        <div className="flex aspect-square items-center justify-center bg-[#f0f2f5] text-sm text-[#8a8d91]">No media yet</div>
      ) : carousel ? (
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-3.5 pb-1">
          {assets.map((a) => (
            <div key={a.id} className="w-[78%] shrink-0 snap-start overflow-hidden rounded-lg border">
              <Media asset={a} />
              <LinkBar domain={domain} copy={copy} compact />
            </div>
          ))}
        </div>
      ) : (
        <>
          <Media asset={assets[0]} />
          <LinkBar domain={domain} copy={copy} />
        </>
      )}

      <div className="mt-1 flex justify-around border-t px-2 py-1.5 text-[13px] font-medium text-[#65676b]">
        <span className="flex items-center gap-1.5 py-1"><ThumbsUp className="h-4 w-4" /> Like</span>
        <span className="flex items-center gap-1.5 py-1"><MessageCircle className="h-4 w-4" /> Comment</span>
        <span className="flex items-center gap-1.5 py-1"><Share2 className="h-4 w-4" /> Share</span>
      </div>
    </div>
  );
}

function Media({ asset }: { asset: AssetView }) {
  if (asset.kind === "video") {
    return <VideoPlayer src={asset.url} className="block aspect-square w-full bg-black object-contain" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset.url} alt={asset.originalName ?? "Ad creative"} className="block aspect-square w-full object-cover" />;
}

function LinkBar({ domain, copy, compact }: { domain: string | null; copy: AdCopy; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 bg-[#f0f2f5] px-3.5 py-2.5">
      <div className="min-w-0 flex-1 leading-tight">
        {domain && <p className="truncate text-[11px] text-[#65676b]">{domain}</p>}
        <p className="truncate font-semibold">{copy.headline || <span className="italic font-normal text-[#8a8d91]">Headline</span>}</p>
        {!compact && copy.description && <p className="truncate text-[13px] text-[#65676b]">{copy.description}</p>}
      </div>
      {copy.cta && (
        <span className="shrink-0 rounded-md bg-[#e4e6eb] px-3 py-1.5 text-[13px] font-semibold">{copy.cta}</span>
      )}
    </div>
  );
}
