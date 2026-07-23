import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listDriveFilesInFolder, GoogleNotConnectedError, type DriveFile } from "@/lib/google";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/projects/${params.id}`);
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load project: ${error.message}`);
  }
  if (!project) {
    notFound();
  }

  const driveFiles = project.drive_folder_id
    ? await loadDriveFiles(user.id, project.drive_folder_id)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/projects"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to projects
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          {project.description && (
            <p className="mt-1 text-muted-foreground">{project.description}</p>
          )}
        </div>
        <Badge variant="secondary">{project.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Drive files</CardTitle>
          <CardDescription>
            {project.drive_folder_id
              ? "Files from this project's linked Drive folder."
              : "No Drive folder linked to this project yet."}
          </CardDescription>
        </CardHeader>
        {driveFiles && (
          <CardContent>
            {"error" in driveFiles ? (
              <p className="text-sm text-destructive">{driveFiles.error}</p>
            ) : driveFiles.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files found.</p>
            ) : (
              <ul className="divide-y">
                {driveFiles.files.map((file) => (
                  <DriveFileRow key={file.id} file={file} />
                ))}
              </ul>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function DriveFileRow({ file }: { file: DriveFile }) {
  return (
    <li className="flex items-center justify-between gap-4 py-2 text-sm">
      <a
        href={file.webViewLink}
        target="_blank"
        rel="noreferrer"
        className="truncate hover:underline"
      >
        {file.name}
      </a>
      {file.modifiedTime && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(file.modifiedTime).toLocaleDateString()}
        </span>
      )}
    </li>
  );
}

async function loadDriveFiles(userId: string, folderId: string) {
  try {
    return await listDriveFilesInFolder(userId, folderId);
  } catch (err) {
    if (err instanceof GoogleNotConnectedError) {
      return { error: "Reconnect your Google account to view Drive files." };
    }
    return { error: "Failed to load Drive files." };
  }
}
