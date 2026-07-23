import "server-only";
import { getValidAccessToken } from "./tokens";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

interface ListDriveFilesOptions {
  /** Drive query string, e.g. `'parents' in id`. See Drive API `q` syntax. */
  query?: string;
  pageSize?: number;
  pageToken?: string;
}

interface ListDriveFilesResult {
  files: DriveFile[];
  nextPageToken?: string;
}

const FILE_FIELDS =
  "id,name,mimeType,iconLink,webViewLink,modifiedTime,size";

/**
 * Lists Drive files visible to the connected user's Google account,
 * scoped to whatever the drive.file / drive.readonly grant allows.
 */
export async function listDriveFiles(
  userId: string,
  { query, pageSize = 25, pageToken }: ListDriveFilesOptions = {}
): Promise<ListDriveFilesResult> {
  const accessToken = await getValidAccessToken(userId);

  const params = new URLSearchParams({
    fields: `nextPageToken, files(${FILE_FIELDS})`,
    pageSize: String(pageSize),
  });
  if (query) params.set("q", query);
  if (pageToken) params.set("pageToken", pageToken);

  const response = await driveFetch(`${DRIVE_API_BASE}/files?${params}`, accessToken);
  const data = await response.json();

  return { files: data.files ?? [], nextPageToken: data.nextPageToken };
}

/** Lists files inside a given Drive folder (e.g. a project's linked folder). */
export async function listDriveFilesInFolder(
  userId: string,
  folderId: string,
  options: Omit<ListDriveFilesOptions, "query"> = {}
): Promise<ListDriveFilesResult> {
  return listDriveFiles(userId, {
    ...options,
    query: `'${folderId}' in parents and trashed = false`,
  });
}

export async function getDriveFile(userId: string, fileId: string): Promise<DriveFile> {
  const accessToken = await getValidAccessToken(userId);

  const params = new URLSearchParams({ fields: FILE_FIELDS });
  const response = await driveFetch(
    `${DRIVE_API_BASE}/files/${fileId}?${params}`,
    accessToken
  );

  return response.json();
}

async function driveFetch(url: string, accessToken: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${body}`);
  }

  return response;
}
