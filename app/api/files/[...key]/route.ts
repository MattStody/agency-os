// Serves and accepts files for the LOCAL storage driver only. Access is by
// HMAC-signed, expiring URL (issued after the app's permission checks), the
// same model as Supabase signed URLs. Supports Range requests for video seeking.
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { type NextRequest } from "next/server";
import { getStorage } from "@/lib/storage";
import { localPath } from "@/lib/storage/local";
import { isSafeKey, verifyFile } from "@/lib/storage/signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

function keyFrom(params: { key: string[] }) {
  const key = params.key.map(decodeURIComponent).join("/");
  return isSafeKey(key) ? key : null;
}

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(req: NextRequest, { params }: { params: { key: string[] } }) {
  if (getStorage().name !== "local") return notFound();
  const key = keyFrom(params);
  const exp = Number(req.nextUrl.searchParams.get("exp"));
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  if (!key || !verifyFile("get", key, exp, sig)) return new Response("Forbidden", { status: 403 });

  let file: string, size: number;
  try {
    file = localPath(key);
    size = (await stat(file)).size;
  } catch {
    return notFound();
  }
  const type = MIME[path.extname(key).slice(1).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "content-type": type,
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=3600",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
  };

  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    let start = range[1] ? Number(range[1]) : NaN;
    let end = range[2] ? Number(range[2]) : size - 1;
    if (Number.isNaN(start)) {
      start = Math.max(0, size - end); // suffix range: last N bytes
      end = size - 1;
    }
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "content-length": String(size) } });
}

export async function PUT(req: NextRequest, { params }: { params: { key: string[] } }) {
  if (getStorage().name !== "local") return notFound();
  const key = keyFrom(params);
  const sp = req.nextUrl.searchParams;
  const exp = Number(sp.get("exp"));
  const ct = sp.get("ct") ?? "";
  const max = Number(sp.get("max"));
  if (!key || !verifyFile("put", key, exp, sp.get("sig") ?? "", `${ct}\n${max}`)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!req.body) return new Response("Empty body", { status: 400 });

  const dest = localPath(key);
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  let written = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      written += chunk.length;
      if (written > max) cb(new Error("too large"));
      else cb(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(req.body as never), limit, createWriteStream(tmp, { flags: "wx" }));
    await rename(tmp, dest);
  } catch (e) {
    await rm(tmp, { force: true });
    const tooLarge = e instanceof Error && e.message === "too large";
    return new Response(tooLarge ? "File too large" : "Upload failed", { status: tooLarge ? 413 : 500 });
  }
  return new Response(null, { status: 201 });
}
