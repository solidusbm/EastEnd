import { NextResponse } from "next/server";
import { backupImageToGithub, isGithubBackupConfigured } from "@/lib/githubBackup";
import { readUploadFile } from "@/lib/uploads";
import { readStore } from "@/lib/store";

/**
 * Manually backs up every current image. Each one is checked against what's
 * already on GitHub by content (not just filename) -- see backupImageToGithub
 * -- so an image that was backed up before but has since changed under the
 * same filename still gets re-uploaded, not skipped.
 */
export async function POST() {
  if (!(await isGithubBackupConfigured())) {
    return NextResponse.json({ error: "GitHub backup isn't configured." }, { status: 400 });
  }

  const store = await readStore();

  let backedUp = 0;
  let upToDate = 0;
  let failed = 0;

  for (const image of store.images) {
    const filename = image.url.split("/").pop();
    if (!filename) {
      failed += 1;
      continue;
    }

    const content = await readUploadFile(filename);
    if (!content) {
      failed += 1;
      continue;
    }

    try {
      const wrote = await backupImageToGithub(image.type, filename, content);
      if (wrote) backedUp += 1;
      else upToDate += 1;
    } catch (err) {
      console.error(`[github-backups] Manual backup failed for ${filename}:`, err);
      failed += 1;
    }
  }

  return NextResponse.json({ backedUp, upToDate, failed });
}
