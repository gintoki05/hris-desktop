import type { AuthSession } from "../../auth/types";
import {
  exportPayslipTemplateFile as exportTemplateFileWithRepository,
  generatePayslipPdfs as generatePdfsWithRepository,
  listPayslipPeriods as listPeriodsWithRepository,
  listPayslipPortalStatus as listPortalStatusWithRepository,
  listPayslipSnapshots as listSnapshotsWithRepository,
  publishFinalPayslipsToPortal as publishToPortalWithRepository,
  savePayslipImportBatch as saveImportBatchWithRepository,
  savePayslipPeriod as savePeriodWithRepository,
  sendPayslipManagerEmail as sendEmailWithRepository,
  updatePayslipSnapshotSendStatus as updateSnapshotStatusWithRepository,
} from "../repositories/tauri-payslip-manager.repository";
import type {
  PayslipImportBatch,
  PayslipImportBatchInput,
  PayslipManagerSnapshot,
  PayslipPortalPublishResult,
  PayslipPortalStatusResult,
  PayslipPeriod,
  PayslipPeriodInput,
  PayslipSendStatus,
} from "../types";

export function listPayslipPeriods(): Promise<PayslipPeriod[]> {
  return listPeriodsWithRepository();
}

export function savePayslipPeriod(
  input: PayslipPeriodInput,
  session: AuthSession,
): Promise<PayslipPeriod> {
  return savePeriodWithRepository(input, toActor(session));
}

export function savePayslipImportBatch(
  input: PayslipImportBatchInput,
  session: AuthSession,
): Promise<PayslipImportBatch> {
  return saveImportBatchWithRepository(input, toActor(session));
}

export function listPayslipSnapshots(periodId: string): Promise<PayslipManagerSnapshot[]> {
  return listSnapshotsWithRepository(periodId);
}

export function generatePayslipPdfs(
  periodId: string,
  session: AuthSession,
): Promise<PayslipManagerSnapshot[]> {
  return generatePdfsWithRepository(periodId, toActor(session));
}

export function updatePayslipSnapshotSendStatus(
  snapshotId: string,
  sendStatus: PayslipSendStatus,
  session: AuthSession,
  pdfFilePath?: string,
): Promise<PayslipManagerSnapshot> {
  return updateSnapshotStatusWithRepository(snapshotId, sendStatus, toActor(session), pdfFilePath);
}

export function sendPayslipManagerEmail(
  snapshotId: string,
  session: AuthSession,
): Promise<PayslipManagerSnapshot> {
  return sendEmailWithRepository(snapshotId, toActor(session));
}

export function publishFinalPayslipsToPortal(
  periodId: string,
  session: AuthSession,
): Promise<PayslipPortalPublishResult> {
  return publishToPortalWithRepository(periodId, toActor(session));
}

export function listPayslipPortalStatus(
  periodId: string,
  session: AuthSession,
): Promise<PayslipPortalStatusResult> {
  return listPortalStatusWithRepository(periodId, toActor(session));
}

export function exportPayslipTemplateFile(
  targetPath: string,
  bytes: number[],
  session: AuthSession,
): Promise<string> {
  return exportTemplateFileWithRepository(targetPath, bytes, toActor(session));
}

function toActor(session: AuthSession) {
  return {
    userId: session.user.id,
    displayName: session.user.displayName,
    role: session.user.role,
  };
}
