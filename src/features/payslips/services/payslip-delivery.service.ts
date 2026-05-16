import type { AuthSession } from "../../auth/types";
import {
  listPayslipDeliveryQueue as listQueueWithRepository,
  updatePayslipDeliveryStatus as updateStatusWithRepository,
} from "../repositories/tauri-payslip-delivery.repository";
import type { PayslipDeliveryQueueItem, PayslipWhatsappStatus } from "../types";

const EMAIL_DELIVERY_DISABLED_MESSAGE =
  "Pengiriman email Resend sedang dinonaktifkan sementara. Gunakan pengiriman WhatsApp manual.";

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
  void payslipSnapshotId;
  void session;
  return Promise.reject(new Error(EMAIL_DELIVERY_DISABLED_MESSAGE));
}
