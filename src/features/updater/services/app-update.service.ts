import { getVersion } from "@tauri-apps/api/app";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import type { AppUpdateCheckResult, AppUpdateInstallProgress } from "../types";

let pendingUpdate: Update | null = null;

export async function checkForAppUpdate(): Promise<AppUpdateCheckResult> {
  await clearPendingUpdate();

  const update = await check({ timeout: 30000 });

  if (!update) {
    return {
      currentVersion: await getVersion(),
      status: "current",
    };
  }

  pendingUpdate = update;

  return {
    currentVersion: update.currentVersion,
    latestVersion: update.version,
    notes: update.body?.trim() ?? "",
    publishedAt: update.date ?? null,
    status: "available",
  };
}

export async function installPendingAppUpdate(
  onProgress: (progress: AppUpdateInstallProgress) => void,
): Promise<void> {
  if (!pendingUpdate) {
    throw new Error("Belum ada update yang siap di-install. Jalankan cek update terlebih dahulu.");
  }

  let downloadedBytes = 0;
  let totalBytes: number | null = null;

  await pendingUpdate.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === "Started") {
      downloadedBytes = 0;
      totalBytes = event.data.contentLength ?? null;
      onProgress(toProgress(downloadedBytes, totalBytes, "downloading"));
      return;
    }

    if (event.event === "Progress") {
      downloadedBytes += event.data.chunkLength;
      onProgress(toProgress(downloadedBytes, totalBytes, "downloading"));
      return;
    }

    onProgress(toProgress(downloadedBytes, totalBytes, "installing"));
  });

  pendingUpdate = null;
}

async function clearPendingUpdate(): Promise<void> {
  if (!pendingUpdate) {
    return;
  }

  const staleUpdate = pendingUpdate;
  pendingUpdate = null;

  try {
    await staleUpdate.close();
  } catch {
    // Best effort resource cleanup; stale updater resources should not block a fresh check.
  }
}

function toProgress(
  downloadedBytes: number,
  totalBytes: number | null,
  status: AppUpdateInstallProgress["status"],
): AppUpdateInstallProgress {
  return {
    downloadedBytes,
    percentage: totalBytes ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : null,
    status,
    totalBytes,
  };
}
