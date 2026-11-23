"use client";

import { CheckCircle2, Clock, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { ActionButton } from "@/components/forms/action-button";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Textarea } from "@/components/ui/input";
import { initialActionState, type ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { CommentView } from "@/modules/approvals/service";
import { formatTimecode } from "./labels";
import { usePlayer } from "./player";

const when = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function CommentThread({
  comments,
  shownVersionId,
  shownVersionNo,
  addAction,
  resolveActions,
  canComment,
  isInternal,
}: {
  comments: CommentView[];
  shownVersionId: string;
  shownVersionNo: number;
  addAction: (s: ActionState, fd: FormData) => Promise<ActionState>;
  resolveActions?: Record<string, (resolved: boolean) => Promise<ActionState>>;
  canComment: boolean;
  isInternal: boolean;
}) {
  const { seek, currentTime, hasVideo } = usePlayer();
  const [state, formAction] = useFormState(addAction, initialActionState);
  const [stamp, setStamp] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <div>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ol className="space-y-4">
          {comments.map((c) => {
            const sameVersion = c.versionId === shownVersionId;
            const resolve = resolveActions?.[c.id];
            return (
              <li
                key={c.id}
                id={`comment-${c.id}`}
                className={cn(
                  "scroll-mt-24 rounded-lg border px-3.5 py-3",
                  c.isInternal ? "border-dashed border-brand-sage bg-brand-paper/60" : "bg-white",
                  c.resolvedAt && "opacity-60"
                )}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-medium text-brand-ink">{c.authorName ?? "Someone"}</span>
                    {c.authorIsStaff && (
                      <span className="rounded bg-brand-ink px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-brand-mint">
                        Boldly
                      </span>
                    )}
                    {c.isInternal && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wider text-brand-sea">
                        <Lock className="h-3 w-3" /> Internal
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {!sameVersion && <span className="mr-1.5 rounded bg-muted px-1 py-px">v{c.versionNo}</span>}
                    {when.format(c.createdAt)}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">
                  {c.timecodeS !== null &&
                    (sameVersion ? (
                      <button
                        type="button"
                        onClick={() => seek(c.timecodeS!)}
                        className="mr-1.5 inline-flex items-center gap-1 rounded bg-brand-periwinkle/15 px-1.5 py-px align-middle font-mono text-xs text-brand-ink hover:bg-brand-periwinkle/30"
                        title="Jump to this moment"
                      >
                        <Clock className="h-3 w-3" /> {formatTimecode(c.timecodeS)}
                      </button>
                    ) : (
                      <Link
                        href={`?v=${c.versionNo}&t=${c.timecodeS}#comment-${c.id}`}
                        className="mr-1.5 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-px align-middle font-mono text-xs"
                        title={`Open version ${c.versionNo} at this moment`}
                      >
                        <Clock className="h-3 w-3" /> {formatTimecode(c.timecodeS)}
                      </Link>
                    ))}
                  {c.body}
                </p>
                {resolve && (
                  <div className="mt-1.5 flex justify-end">
                    <ActionButton variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" action={() => resolve(!c.resolvedAt)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> {c.resolvedAt ? "Reopen" : "Resolve"}
                    </ActionButton>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {canComment && (
        <form ref={formRef} action={formAction} className="mt-5 space-y-2.5">
          <input type="hidden" name="versionId" value={shownVersionId} />
          {hasVideo && stamp && <input type="hidden" name="timecodeS" value={currentTime.toFixed(2)} />}
          <Textarea
            name="body"
            required
            rows={3}
            placeholder={hasVideo ? "Comment on this moment, or the whole clip…" : `Comment on version ${shownVersionNo}…`}
            aria-label="Comment"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {hasVideo && (
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={stamp} onChange={(e) => setStamp(e.target.checked)} className="accent-brand-ink" />
                  At <span className="font-mono text-brand-ink">{formatTimecode(currentTime)}</span>
                </label>
              )}
              {isInternal && (
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" name="isInternal" className="accent-brand-ink" /> Internal note
                </label>
              )}
            </div>
            <SubmitButton size="sm" pendingLabel="Posting…">
              Comment
            </SubmitButton>
          </div>
          <FormMessage state={state} />
        </form>
      )}
    </div>
  );
}
