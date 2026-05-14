import { invoke } from "@tauri-apps/api/core";
import type {
  PayslipImportBatch,
  PayslipImportBatchInput,
  PayslipManagerSnapshot,
  PayslipPeriod,
  PayslipPeriodInput,
  PayslipSendStatus,
} from "../types";

type PayslipManagerActor = {
  userId: string;
  displayName: string;
  role: string;
};

type PayslipManagerActorDto = {
  user_id: string;
  display_name: string;
  role: string;
};

type PayslipPeriodDto = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  status: PayslipPeriod["status"];
  created_at: string;
  updated_at: string;
};

type PayslipImportBatchDto = {
  id: string;
  period_id: string;
  source_file_name: string;
  imported_by_display_name: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  notes: string;
  imported_at: string;
};

type PayslipSnapshotDto = {
  id: string;
  period_id: string;
  import_batch_id: string;
  employee_id: string | null;
  employee_nik: string;
  employee_name: string;
  employee_position: string;
  whatsapp_number: string;
  snapshot_json: string;
  net_pay: number;
  pdf_file_path: string;
  send_status: PayslipSendStatus;
  whatsapp_status: PayslipManagerSnapshot["whatsappStatus"];
  email_status: PayslipManagerSnapshot["emailStatus"];
  whatsapp_opened_at: string | null;
  whatsapp_sent_at: string | null;
  whatsapp_failed_at: string | null;
  email_sent_at: string | null;
  email_failed_at: string | null;
  email_error_message: string;
  status_updated_at: string;
  created_at: string;
  updated_at: string;
};

export async function listPayslipPeriods(): Promise<PayslipPeriod[]> {
  ensureTauriRuntime();
  const dto = await invoke<PayslipPeriodDto[]>("list_payslip_periods");
  return dto.map(toPeriod);
}

export async function savePayslipPeriod(
  input: PayslipPeriodInput,
  actor: PayslipManagerActor,
): Promise<PayslipPeriod> {
  ensureTauriRuntime();
  const dto = await invoke<PayslipPeriodDto>("save_payslip_period", {
    input: {
      id: input.id,
      label: input.label,
      start_date: input.startDate,
      end_date: input.endDate,
      actor: toActorDto(actor),
    },
  });

  return toPeriod(dto);
}

export async function savePayslipImportBatch(
  input: PayslipImportBatchInput,
  actor: PayslipManagerActor,
): Promise<PayslipImportBatch> {
  ensureTauriRuntime();
  const dto = await invoke<PayslipImportBatchDto>("save_payslip_import_batch", {
    input: {
      period_id: input.periodId,
      source_file_name: input.sourceFileName,
      total_rows: input.totalRows,
      valid_rows: input.validRows,
      error_rows: input.errorRows,
      notes: input.notes,
      snapshots: input.snapshots.map((snapshot) => ({
        id: snapshot.id,
        employee_id: snapshot.employeeId,
        employee_nik: snapshot.employeeNik,
        employee_name: snapshot.employeeName,
        employee_position: snapshot.employeePosition,
        whatsapp_number: snapshot.whatsappNumber,
        snapshot_json: snapshot.snapshotJson,
        net_pay: snapshot.netPay,
      })),
      actor: toActorDto(actor),
    },
  });

  return toImportBatch(dto);
}

export async function listPayslipSnapshots(periodId: string): Promise<PayslipManagerSnapshot[]> {
  ensureTauriRuntime();
  const dto = await invoke<PayslipSnapshotDto[]>("list_payslip_snapshots", {
    query: {
      period_id: periodId,
    },
  });

  return dto.map(toSnapshot);
}

export async function generatePayslipPdfs(
  periodId: string,
  actor: PayslipManagerActor,
): Promise<PayslipManagerSnapshot[]> {
  ensureTauriRuntime();
  const dto = await invoke<PayslipSnapshotDto[]>("generate_payslip_pdfs", {
    input: {
      period_id: periodId,
      actor: toActorDto(actor),
    },
  });

  return dto.map(toSnapshot);
}

export async function updatePayslipSnapshotSendStatus(
  snapshotId: string,
  sendStatus: PayslipSendStatus,
  actor: PayslipManagerActor,
  pdfFilePath?: string,
): Promise<PayslipManagerSnapshot> {
  ensureTauriRuntime();
  const dto = await invoke<PayslipSnapshotDto>("update_payslip_snapshot_send_status", {
    input: {
      snapshot_id: snapshotId,
      send_status: sendStatus,
      pdf_file_path: pdfFilePath,
      actor: toActorDto(actor),
    },
  });

  return toSnapshot(dto);
}

export async function sendPayslipManagerEmail(
  snapshotId: string,
  actor: PayslipManagerActor,
): Promise<PayslipManagerSnapshot> {
  ensureTauriRuntime();
  const dto = await invoke<PayslipSnapshotDto>("send_payslip_manager_email", {
    input: {
      snapshot_id: snapshotId,
      actor: toActorDto(actor),
    },
  });

  return toSnapshot(dto);
}

export async function exportPayslipTemplateFile(
  targetPath: string,
  bytes: number[],
  actor: PayslipManagerActor,
): Promise<string> {
  ensureTauriRuntime();
  return invoke<string>("export_payslip_template_file", {
    input: {
      target_path: targetPath,
      bytes,
      actor: toActorDto(actor),
    },
  });
}

function toActorDto(actor: PayslipManagerActor): PayslipManagerActorDto {
  return {
    user_id: actor.userId,
    display_name: actor.displayName,
    role: actor.role,
  };
}

function toPeriod(dto: PayslipPeriodDto): PayslipPeriod {
  return {
    id: dto.id,
    label: dto.label,
    startDate: dto.start_date,
    endDate: dto.end_date,
    status: dto.status,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function toImportBatch(dto: PayslipImportBatchDto): PayslipImportBatch {
  return {
    id: dto.id,
    periodId: dto.period_id,
    sourceFileName: dto.source_file_name,
    importedByDisplayName: dto.imported_by_display_name,
    totalRows: dto.total_rows,
    validRows: dto.valid_rows,
    errorRows: dto.error_rows,
    notes: dto.notes,
    importedAt: dto.imported_at,
  };
}

function toSnapshot(dto: PayslipSnapshotDto): PayslipManagerSnapshot {
  return {
    id: dto.id,
    periodId: dto.period_id,
    importBatchId: dto.import_batch_id,
    employeeId: dto.employee_id,
    employeeNik: dto.employee_nik,
    employeeName: dto.employee_name,
    employeePosition: dto.employee_position,
    whatsappNumber: dto.whatsapp_number,
    snapshotJson: dto.snapshot_json,
    netPay: dto.net_pay,
    pdfFilePath: dto.pdf_file_path,
    sendStatus: dto.send_status,
    whatsappStatus: dto.whatsapp_status,
    emailStatus: dto.email_status,
    whatsappOpenedAt: dto.whatsapp_opened_at,
    whatsappSentAt: dto.whatsapp_sent_at,
    whatsappFailedAt: dto.whatsapp_failed_at,
    emailSentAt: dto.email_sent_at,
    emailFailedAt: dto.email_failed_at,
    emailErrorMessage: dto.email_error_message,
    statusUpdatedAt: dto.status_updated_at,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function ensureTauriRuntime(): void {
  if (typeof window === "undefined" || typeof window.__TAURI_INTERNALS__?.invoke !== "function") {
    throw new Error("Payslip Manager hanya tersedia saat aplikasi berjalan sebagai desktop app.");
  }
}
