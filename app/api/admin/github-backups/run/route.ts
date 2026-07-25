import { NextResponse } from "next/server";
import { backupImageToGithub, isGithubBackupConfigured, listGithubBackups } from "@/lib/githubBackup";
import { readUploadFile } from "@/lib/uploads";
import { readStore } from "@/lib/store";

/**
 * Manually backs up every current image that isn't already on GitHub --
 * covers images uploaded before backup was configured, or any that missed
 * their automatic backup (see backupImageToGithubBestEffort in uploads.ts).
 */
export async function POST() {
  if (!(await isGithubBackupConfigured())) {
    return NextResponse.json({ error: "GitHub backup isn't configured." }, { status: 400 });
  }

  const [store, existing] = await Promise.all([readStore(), listGithubBackups()]);
  const alreadyBackedUp = new Set(
    Object.entries(existing ?? {}).flatMap(([type, files]) => files.map((filename) => `${type}/${filename}`))
  );

  let backedUp = 0;
  let failed = 0;

  for (const image of store.images) {
    const filename = image.url.split("/").pop();
    if (!filename || alreadyBackedUp.has(`${image.type}/${filename}`)) continue;

    const content = await readUploadFile(filename);
    if (!content) {
      failed += 1;
      continue;
    }

    try {
      await backupImageToGithub(image.type, filename, content);
      backedUp += 1;
    } catch (err) {
      console.error(`[github-backups] Manual backup failed for ${filename}:`, err);
      failed += 1;
    }
  }

  return NextResponse.json({ backedUp, failed });
}
