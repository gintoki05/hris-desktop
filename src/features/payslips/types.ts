import type { Employee } from "../employees/types";
import type { PayrollComponentAmount, PayrollSnapshot } from "../payroll/types";

export type PayslipCompanySnapshot = {
  name: string;
  address: string;
  treasurerName: string;
};

export type PayslipEmployeeSnapshot = Pick<Employee, "id" | "nik" | "name" | "position" | "npwp" | "whatsappNumber" | "email">;

export type PayslipSnapshot = {
  company: PayslipCompanySnapshot;
  employee: PayslipEmployeeSnapshot;
  payroll: PayrollSnapshot;
  amountInWords: string;
};

export type PayslipWhatsappStatus = "not_opened" | "opened" | "sent_manual" | "failed" | "missing_number";
export type PayslipEmailStatus = "not_sent" | "sent" | "failed" | "missing_email";

export type PayslipDeliveryQueueItem = {
  payslipSnapshotId: string;
  payrollRunId: string;
  employeeId: string;
  employeeNik: string;
  employeeName: string;
  employeePosition: string;
  whatsappNumber: string;
  employeeEmail: string;
  periodLabel: string;
  netPay: number;
  pdfFilePath: string;
  whatsappStatus: PayslipWhatsappStatus;
  emailStatus: PayslipEmailStatus;
  whatsappOpenedAt: string | null;
  whatsappSentAt: string | null;
  whatsappFailedAt: string | null;
  emailSentAt: string | null;
  emailFailedAt: string | null;
  emailProviderMessageId: string;
  whatsappErrorMessage: string;
  emailErrorMessage: string;
  updatedAt: string;
};

export type PayslipPeriodStatus = "draft" | "imported" | "pdf_ready" | "archived";

export type PayslipPeriod = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: PayslipPeriodStatus;
  createdAt: string;
  updatedAt: string;
};

export type PayslipPeriodInput = {
  id?: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type PayslipSendStatus =
  | "not_generated"
  | "pdf_ready"
  | "whatsapp_opened"
  | "sent"
  | "failed_missing_number"
  | "failed";

export type PayslipManagerWhatsappStatus = "not_opened" | "opened" | "sent_manual" | "failed" | "missing_number";
export type PayslipManagerEmailStatus = "not_sent" | "sent" | "failed" | "missing_email";
export type PayslipPortalPublishStatus = "not_published" | "published" | "failed";

export type PayslipImportSnapshotInput = {
  id?: string;
  employeeId?: string;
  employeeNik: string;
  employeeName: string;
  employeePosition: string;
  whatsappNumber: string;
  snapshotJson: string;
  netPay: number;
};

export type PayslipImportBatchInput = {
  periodId: string;
  sourceFileName: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  notes: string;
  snapshots: PayslipImportSnapshotInput[];
};

export type PayslipImportBatch = {
  id: string;
  periodId: string;
  sourceFileName: string;
  importedByDisplayName: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  notes: string;
  importedAt: string;
};

export type PayslipManagerSnapshot = {
  id: string;
  periodId: string;
  importBatchId: string;
  employeeId: string | null;
  employeeNik: string;
  employeeName: string;
  employeePosition: string;
  whatsappNumber: string;
  snapshotJson: string;
  netPay: number;
  pdfFilePath: string;
  sendStatus: PayslipSendStatus;
  whatsappStatus: PayslipManagerWhatsappStatus;
  emailStatus: PayslipManagerEmailStatus;
  whatsappOpenedAt: string | null;
  whatsappSentAt: string | null;
  whatsappFailedAt: string | null;
  emailSentAt: string | null;
  emailFailedAt: string | null;
  emailErrorMessage: string;
  portalPublishStatus: PayslipPortalPublishStatus;
  portalPublishedAt: string | null;
  portalStoragePath: string;
  portalPayslipId: string;
  portalErrorMessage: string;
  statusUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PayslipPortalPublishResult = {
  periodId: string;
  attemptedCount: number;
  publishedCount: number;
  failedCount: number;
  items: PayslipPortalPublishItemResult[];
};

export type PayslipPortalPublishItemResult = {
  snapshotId: string;
  employeeName: string;
  status: "published" | "failed";
  storagePath: string;
  errorMessage: string;
};

export type PayslipImportPreviewRowStatus = "valid" | "warning" | "error";

export type PayslipImportPreviewRow = {
  rowNumber: number;
  employeeId: string | null;
  employeeNik: string;
  employeeName: string;
  employeePosition: string;
  whatsappNumber: string;
  matchedEmployeeName: string;
  incomeComponents: PayrollComponentAmount[];
  deductionComponents: PayrollComponentAmount[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  amountInWords: string;
  snapshotJson: string;
  status: PayslipImportPreviewRowStatus;
  errorMessage: string;
};

export type PayslipImportPreview = {
  sourceFileName: string;
  sheetName: string;
  rows: PayslipImportPreviewRow[];
};
