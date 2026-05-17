export type AppUpdateCheckResult =
  | {
      status: "available";
      currentVersion: string;
      latestVersion: string;
      notes: string;
      publishedAt: string | null;
    }
  | {
      status: "current";
      currentVersion: string;
    };

export type AppUpdateInstallProgress = {
  downloadedBytes: number;
  totalBytes: number | null;
  percentage: number | null;
  status: "downloading" | "installing";
};
