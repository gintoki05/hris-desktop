import { useEffect, useMemo, useState } from "react";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { AppNotice } from "../../../components/shared/AppNotice";
import { formatRupiah } from "../../../lib/formatters/currency";
import type { AuthSession } from "../../auth/types";
import {
  listPayslipDeliveryQueue,
  sendPayslipEmail,
  updatePayslipDeliveryStatus,
} from "../services/payslip-delivery.service";
import {
  createPayslipWhatsAppMessage,
  maskWhatsAppNumber,
} from "../services/whatsapp-delivery.service";
import type { PayslipDeliveryQueueItem, PayslipEmailStatus, PayslipWhatsappStatus } from "../types";

type PayslipWhatsAppPanelProps = {
  session: AuthSession;
};

const WHATSAPP_STATUS_LABELS: Record<PayslipWhatsappStatus, string> = {
  failed: "Gagal",
  not_opened: "Belum dibuka",
  opened: "Dibuka",
  sent_manual: "Terkirim manual",
  missing_number: "Nomor kosong",
};

const EMAIL_STATUS_LABELS: Record<PayslipEmailStatus, string> = {
  failed: "Gagal",
  missing_email: "Email kosong",
  not_sent: "Belum",
  sent: "Terkirim",
};

export function PayslipWhatsAppPanel({ session }: PayslipWhatsAppPanelProps) {
  const [queue, setQueue] = useState<PayslipDeliveryQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshQueue();
  }, []);

  const summary = useMemo(
    () => ({
      total: queue.length,
      pdfReady: queue.filter((item) => item.pdfFilePath.trim()).length,
      whatsappSent: queue.filter((item) => getWhatsappStatus(item) === "sent_manual").length,
      emailSent: queue.filter((item) => getEmailStatus(item) === "sent").length,
      undelivered: queue.filter((item) => getWhatsappStatus(item) !== "sent_manual" && getEmailStatus(item) !== "sent").length,
    }),
    [queue],
  );

  async function refreshQueue() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setQueue(await listPayslipDeliveryQueue());
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Queue slip gagal dibaca.");
    } finally {
      setIsLoading(false);
    }
  }

  async function setItemStatus(item: PayslipDeliveryQueueItem, status: PayslipWhatsappStatus) {
    setIsUpdating(item.payslipSnapshotId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await updatePayslipDeliveryStatus(item.payslipSnapshotId, status, session);
      setQueue((current) =>
        current.map((queueItem) =>
          queueItem.payslipSnapshotId === updated.payslipSnapshotId ? updated : queueItem,
        ),
      );
      setSuccessMessage(`Status WA ${item.employeeName} menjadi ${WHATSAPP_STATUS_LABELS[status]}.`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Status pengiriman gagal disimpan.");
    } finally {
      setIsUpdating(null);
    }
  }

  async function openWhatsApp(item: PayslipDeliveryQueueItem) {
    try {
      const message = createPayslipWhatsAppMessage({
        employeeName: item.employeeName,
        payrollPeriod: item.periodLabel,
        whatsappNumber: item.whatsappNumber,
        pdfFileName: fileNameFromPath(item.pdfFilePath),
      });

      await setItemStatus(item, "opened");
      await openUrl(message.waMeUrl);
    } catch (error: unknown) {
      setErrorMessage(`Link WhatsApp gagal dibuka: ${getErrorMessage(error)}`);
    }
  }

  async function copyMessage(item: PayslipDeliveryQueueItem) {
    try {
      const message = createPayslipWhatsAppMessage({
        employeeName: item.employeeName,
        payrollPeriod: item.periodLabel,
        whatsappNumber: item.whatsappNumber,
        pdfFileName: fileNameFromPath(item.pdfFilePath),
      });
      await navigator.clipboard.writeText(message.message);
      setSuccessMessage(`Pesan ${item.employeeName} disalin.`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Pesan WhatsApp gagal disalin.");
    }
  }

  async function openPdf(item: PayslipDeliveryQueueItem) {
    if (!item.pdfFilePath) {
      setErrorMessage("Path PDF slip belum tersedia.");
      return;
    }

    try {
      await openPath(item.pdfFilePath);
    } catch (error: unknown) {
      setErrorMessage(`PDF slip gagal dibuka: ${getErrorMessage(error)}`);
    }
  }

  async function sendEmail(item: PayslipDeliveryQueueItem) {
    setIsUpdating(item.payslipSnapshotId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await sendPayslipEmail(item.payslipSnapshotId, session);
      setQueue((current) =>
        current.map((queueItem) =>
          queueItem.payslipSnapshotId === updated.payslipSnapshotId ? updated : queueItem,
        ),
      );
      setSuccessMessage(`Email slip ${item.employeeName} terkirim.`);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setErrorMessage(message);

      try {
        const refreshedQueue = await listPayslipDeliveryQueue();
        setQueue(refreshedQueue);
      } catch {
        setErrorMessage(message);
      }
    } finally {
      setIsUpdating(null);
    }
  }

  return (
    <section className="panel" aria-label="Queue pengiriman slip gaji">
      <div className="panel-header">
        <h2>Queue Pengiriman Slip</h2>
        <span className="status-pill">Email otomatis + WA manual</span>
      </div>

      {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
      {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

      <div className="payslip-queue-summary">
        <span>PDF siap: <strong>{summary.pdfReady}</strong></span>
        <span>WA terkirim: <strong>{summary.whatsappSent}</strong></span>
        <span>Email terkirim: <strong>{summary.emailSent}</strong></span>
        <span>Belum terkirim via jalur apa pun: <strong>{summary.undelivered}</strong></span>
        <button onClick={() => void refreshQueue()} type="button">Refresh</button>
      </div>

      <div className="payslip-queue-table-wrap">
        {isLoading ? <p className="status-note">Membaca queue slip final...</p> : null}
        <table className="payslip-queue-table">
          <thead>
            <tr>
              <th>Karyawan</th>
              <th>Periode</th>
              <th>Nomor WA</th>
              <th>Alamat Email</th>
              <th>Gaji Bersih</th>
              <th>PDF</th>
              <th>WA</th>
              <th>Email</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((item) => (
              <tr key={item.payslipSnapshotId} data-status={getWhatsappStatus(item)}>
                <td>
                  <strong>{item.employeeName}</strong>
                  <span>{item.employeeNik} | {item.employeePosition}</span>
                </td>
                <td>{item.periodLabel}</td>
                <td>{item.whatsappNumber ? maskWhatsAppNumber(item.whatsappNumber) : "-"}</td>
                <td>{maskEmail(item.employeeEmail)}</td>
                <td>{formatRupiah(item.netPay)}</td>
                <td>{fileNameFromPath(item.pdfFilePath)}</td>
                <td>
                  <span className="status-pill">{WHATSAPP_STATUS_LABELS[getWhatsappStatus(item)]}</span>
                  {item.whatsappErrorMessage ? <span className="delivery-error-note">{item.whatsappErrorMessage}</span> : null}
                </td>
                <td>
                  <span className="status-pill">{EMAIL_STATUS_LABELS[getEmailStatus(item)]}</span>
                  {item.emailErrorMessage ? <span className="delivery-error-note">{item.emailErrorMessage}</span> : null}
                </td>
                <td>
                  <div className="payslip-queue-actions">
                    <button
                      disabled={isUpdating === item.payslipSnapshotId || !item.employeeEmail || !item.pdfFilePath}
                      onClick={() => void sendEmail(item)}
                      type="button"
                    >
                      Kirim Email
                    </button>
                    <button
                      disabled={isUpdating === item.payslipSnapshotId || !item.pdfFilePath}
                      onClick={() => void openPdf(item)}
                      type="button"
                    >
                      Buka PDF
                    </button>
                    <button
                      disabled={isUpdating === item.payslipSnapshotId || !item.whatsappNumber}
                      onClick={() => void openWhatsApp(item)}
                      type="button"
                    >
                      Buka WA
                    </button>
                    <button
                      disabled={isUpdating === item.payslipSnapshotId || !item.whatsappNumber}
                      onClick={() => void copyMessage(item)}
                      type="button"
                    >
                      Salin
                    </button>
                    <button
                      disabled={isUpdating === item.payslipSnapshotId}
                      onClick={() => void setItemStatus(item, "sent_manual")}
                      type="button"
                    >
                      Terkirim
                    </button>
                    <button
                      disabled={isUpdating === item.payslipSnapshotId}
                      onClick={() => void setItemStatus(item, item.whatsappNumber ? "failed" : "missing_number")}
                      type="button"
                    >
                      Gagal
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && queue.length === 0 ? (
              <tr>
                <td colSpan={9}>Belum ada slip payroll final. Finalisasi payroll dulu.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() || "-";
}

function maskEmail(value: string): string {
  const [localPart, domain] = value.split("@");

  if (!localPart || !domain) {
    return "-";
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

function getWhatsappStatus(item: PayslipDeliveryQueueItem): PayslipWhatsappStatus {
  if (!item.whatsappNumber.trim() && item.whatsappStatus !== "sent_manual") {
    return "missing_number";
  }

  return item.whatsappStatus;
}

function getEmailStatus(item: PayslipDeliveryQueueItem): PayslipEmailStatus {
  if (!item.employeeEmail.trim() && item.emailStatus !== "sent") {
    return "missing_email";
  }

  return item.emailStatus;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "error tidak dikenal";
}
