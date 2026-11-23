"use client";

import { Film, ImageIcon, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ActionButton } from "@/components/forms/action-button";
import type { ActionState } from "@/lib/actions";
import type { UploadTarget } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import type { RegisterAssetInput, UploadRequest } from "@/modules/approvals/validation";
import { formatBytes } from "./labels";

interface Props {
  accept: string;
  assets: { id: string; kind: "image" | "video"; originalName: string | null; sizeBytes: number }[];
  createUpload: (file: UploadRequest) => Promise<{ key: string; target: UploadTarget } | { error: string }>;
  register: (input: RegisterAssetInput) => Promise<ActionState>;
  removeActions: Record<string, () => Promise<ActionState>>;
}

interface Job {
  name: string;
  progress: number;
  error?: string;
}

function putWithProgress(target: UploadTarget, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.url);
    Object.entries(target.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || `HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}

/** Reads dimensions/duration in the browser so we don't need server-side media tools. */
function probe(file: File): Promise<{ width?: number; height?: number; durationS?: number }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const done = (v: { width?: number; height?: number; durationS?: number }) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => done({ width: v.videoWidth || undefined, height: v.videoHeight || undefined, durationS: Number.isFinite(v.duration) ? v.duration : undefined });
      v.onerror = () => done({});
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => done({});
      img.src = url;
    }
  });
}

export function AssetUploader({ accept, assets, createUpload, register, removeActions }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [drag, setDrag] = useState(false);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setJobs(list.map((f) => ({ name: f.name, progress: 0 })));
    const update = (i: number, patch: Partial<Job>) => setJobs((js) => js.map((j, k) => (k === i ? { ...j, ...patch } : j)));

    await Promise.all(
      list.map(async (file, i) => {
        try {
          const res = await createUpload({ name: file.name, type: file.type, size: file.size });
          if ("error" in res) throw new Error(res.error);
          const meta = await probe(file);
          await putWithProgress(res.target, file, (p) => update(i, { progress: p }));
          const reg = await register({
            key: res.key,
            name: file.name,
            type: file.type,
            size: file.size,
            width: meta.width ? Math.round(meta.width) : null,
            height: meta.height ? Math.round(meta.height) : null,
            durationS: meta.durationS ?? null,
          });
          if (reg.error) throw new Error(reg.error);
          update(i, { progress: 1 });
        } catch (e) {
          update(i, { error: e instanceof Error ? e.message : "Upload failed" });
        }
      })
    );
    setJobs((js) => js.filter((j) => j.error));
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {assets.length > 0 && (
        <ul className="divide-y rounded-lg border bg-white">
          {assets.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              {a.kind === "video" ? <Film className="h-4 w-4 text-brand-sea" /> : <ImageIcon className="h-4 w-4 text-brand-sea" />}
              <span className="min-w-0 flex-1 truncate">{a.originalName ?? "File"}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{formatBytes(a.sizeBytes)}</span>
              <ActionButton variant="ghost" size="icon" className="h-7 w-7" action={removeActions[a.id]} confirm="Remove this file?" aria-label="Remove file">
                <X className="h-4 w-4" />
              </ActionButton>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handle(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-white/60 px-4 py-6 text-sm text-muted-foreground transition hover:border-brand-sage hover:bg-white",
          drag && "border-brand-periwinkle bg-brand-periwinkle/5"
        )}
      >
        <Upload className="h-5 w-5 text-brand-sea" />
        <span>
          <span className="font-medium text-brand-ink">Upload files</span> or drag them here
        </span>
        <span className="text-xs">JPG, PNG, WebP, GIF up to 30 MB · MP4, MOV, WebM up to 1 GB</span>
      </button>
      <input ref={input} type="file" accept={accept} multiple hidden onChange={(e) => void handle(e.target.files)} />

      {jobs.map((j, i) => (
        <div key={i} className="text-xs">
          <div className="flex justify-between">
            <span className="truncate">{j.name}</span>
            <span className={j.error ? "text-destructive" : "text-muted-foreground"}>{j.error ?? `${Math.round(j.progress * 100)}%`}</span>
          </div>
          {!j.error && (
            <div className="mt-1 h-1 overflow-hidden rounded bg-muted">
              <div className="h-full bg-brand-sea transition-all" style={{ width: `${j.progress * 100}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
