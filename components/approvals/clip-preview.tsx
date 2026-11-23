import type { AssetView } from "@/modules/approvals/service";
import { VideoPlayer } from "./player";

/** Vertical (9:16) frame for reels/clips; also shows any stills. */
export function ClipPreview({ assets }: { assets: AssetView[] }) {
  if (assets.length === 0) {
    return (
      <div className="mx-auto flex aspect-[9/16] max-h-[640px] w-full max-w-[360px] items-center justify-center rounded-2xl bg-brand-ink/90 text-sm text-brand-sage">
        No video yet
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {assets.map((a) =>
        a.kind === "video" ? (
          <VideoPlayer
            key={a.id}
            src={a.url}
            className="mx-auto block aspect-[9/16] max-h-[640px] w-auto max-w-full rounded-2xl bg-black object-contain shadow-lg"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={a.id} src={a.url} alt={a.originalName ?? "Still"} className="mx-auto max-h-[640px] rounded-2xl object-contain shadow" />
        )
      )}
    </div>
  );
}
