import type { AuthSession } from "../../auth/types";
import {
  listPayslipDeliveryQueue as listQueueWithRepository,
  sendPayslipEmail as sendEmailWithRepository,
  updatePayslipDeliveryStatus as updateStatusWithRepository,
} from "../repositories/tauri-payslip-delivery.repository";
import type { PayslipDeliveryQueueItem, PayslipWhatsappStatus } from "../types";

export function listPayslipDeliveryQueue(): Promise<PayslipDeliveryQueueItem[]> {
  return listQueueWithRepository();
}

export function updatePayslipDeliveryStatus(
  payslipSnapshotId: string,
  status: PayslipWhatsappStatus,
  session: AuthSession,
): Promise<PayslipDeliveryQueueItem> {
  return updateStatusWithRepository(payslipSnapshotId, status, {
    userId: session.user.id,
    displayName: session.user.displayName,
    role: session.user.role,
  });
}

export function sendPayslipEmail(
  payslipSnapshotId: string,
  session: AuthSession,
): Promise<PayslipDeliveryQueueItem> {
  return sendEmailWithRepository(payslipSnapshotId, {
    userId: session.user.id,
    displayName: session.user.displayName,
    role: session.user.role,
  });
}
