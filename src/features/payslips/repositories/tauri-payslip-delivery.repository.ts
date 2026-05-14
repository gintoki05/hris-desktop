import { invoke } from "@tauri-apps/api/core";
import type { PayslipDeliveryQueueItem, PayslipWhatsappStatus } from "../types";

type PayslipDeliveryQueueItemDto = {
  payslip_snapshot_id: string;
  payroll_run_id: string;
  employee_id: string;
  employee_nik: string;
  employee_name: string;
  employee_position: string;
  whatsapp_number: string;
  employee_email: string;
  period_label: string;
  net_pay: number;
  pdf_file_path: string;
  whatsapp_status: PayslipWhatsappStatus;
  email_status: PayslipDeliveryQueueItem["emailStatus"];
  whatsapp_opened_at: string | null;
  whatsapp_sent_at: string | null;
  whatsapp_failed_at: string | null;
  email_sent_at: string | null;
  email_failed_at: string | null;
  email_provider_message_id: string;
  whatsapp_error_message: string;
  email_error_message: string;
  updated_at: string;
};

type DeliveryActorDto = {
  user_id: string;
  display_name: string;
  role: string;
};

export type PayslipDeliveryActor = {
  userId: string;
  displayName: string;
  role: string;
};

export async function listPayslipDeliveryQueue(): Promise<PayslipDeliveryQueueItem[]> {
  ensureTauriRuntime();
  const dto = await invoke<PayslipDeliveryQueueItemDto[]>("list_payslip_delivery_queue");
  return dto.map(toQueueItem);
}

export async function updatePayslipDeliveryStatus(
  payslipSnapshotId: string,
  status: PayslipWhatsappStatus,
  actor: PayslipDeliveryActor,
): Promise<PayslipDeliveryQueueItem> {
  ensureTauriRuntime();
  const dto = await invoke<PayslipDeliveryQueueItemDto>("update_payslip_delivery_status", {
    input: {
      payslip_snapshot_id: payslipSnapshotId,
      status,
      actor: toActorDto(actor),
    },
  });

  return toQueueItem(dto);
}

export async function sendPayslipEmail(
  payslipSnapshotId: string,
  actor: PayslipDeliveryActor,
): Promise<PayslipDeliveryQueueItem> {
  ensureTauriRuntime();
  const dto = await invoke<PayslipDeliveryQueueItemDto>("send_payslip_email", {
    input: {
      payslip_snapshot_id: payslipSnapshotId,
      status: "sent",
      actor: toActorDto(actor),
    },
  });

  return toQueueItem(dto);
}

function toQueueItem(dto: PayslipDeliveryQueueItemDto): PayslipDeliveryQueueItem {
  return {
    payslipSnapshotId: dto.payslip_snapshot_id,
    payrollRunId: dto.payroll_run_id,
    employeeId: dto.employee_id,
    employeeNik: dto.employee_nik,
    employeeName: dto.employee_name,
    employeePosition: dto.employee_position,
    whatsappNumber: dto.whatsapp_number,
    employeeEmail: dto.employee_email,
    periodLabel: dto.period_label,
    netPay: dto.net_pay,
    pdfFilePath: dto.pdf_file_path,
    whatsappStatus: dto.whatsapp_status,
    emailStatus: dto.email_status,
    whatsappOpenedAt: dto.whatsapp_opened_at,
    whatsappSentAt: dto.whatsapp_sent_at,
    whatsappFailedAt: dto.whatsapp_failed_at,
    emailSentAt: dto.email_sent_at,
    emailFailedAt: dto.email_failed_at,
    emailProviderMessageId: dto.email_provider_message_id,
    whatsappErrorMessage: dto.whatsapp_error_message,
    emailErrorMessage: dto.email_error_message,
    updatedAt: dto.updated_at,
  };
}

function toActorDto(actor: PayslipDeliveryActor): DeliveryActorDto {
  return {
    user_id: actor.userId,
    display_name: actor.displayName,
    role: actor.role,
  };
}

function ensureTauriRuntime(): void {
  if (typeof window === "undefined" || typeof window.__TAURI_INTERNALS__?.invoke !== "function") {
    throw new Error("Queue slip hanya tersedia saat aplikasi berjalan sebagai desktop app.");
  }
}
