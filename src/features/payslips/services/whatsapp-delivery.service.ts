export type PayslipWhatsAppDraft = {
  employeeName: string;
  payrollPeriod: string;
  whatsappNumber: string;
  pdfFileName: string;
};

export type PayslipWhatsAppMessage = {
  normalizedNumber: string;
  maskedNumber: string;
  message: string;
  waMeUrl: string;
};

export function createPayslipWhatsAppMessage(
  draft: PayslipWhatsAppDraft,
): PayslipWhatsAppMessage {
  const employeeName = draft.employeeName.trim();
  const payrollPeriod = draft.payrollPeriod.trim();
  const pdfFileName = draft.pdfFileName.trim();
  const normalizedNumber = normalizeIndonesianWhatsAppNumber(draft.whatsappNumber);

  if (!employeeName) {
    throw new Error("Nama karyawan wajib diisi.");
  }

  if (!payrollPeriod) {
    throw new Error("Periode payroll wajib diisi.");
  }

  if (!normalizedNumber) {
    throw new Error("Nomor WhatsApp wajib diisi.");
  }

  const attachmentLine = pdfFileName
    ? `File PDF: ${pdfFileName}`
    : "File PDF slip gaji akan dilampirkan manual oleh admin payroll.";
  const message = [
    `Halo ${employeeName},`,
    "",
    `Slip gaji periode ${payrollPeriod} sudah disiapkan.`,
    attachmentLine,
    "",
    "Mohon dicek kembali. Terima kasih.",
  ].join("\n");

  return {
    maskedNumber: maskWhatsAppNumber(normalizedNumber),
    message,
    normalizedNumber,
    waMeUrl: `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(message)}`,
  };
}

export function normalizeIndonesianWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("62")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }

  if (digits.startsWith("8")) {
    return `62${digits}`;
  }

  return digits;
}

export function maskWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length <= 7) {
    return digits;
  }

  return `${digits.slice(0, 4)}${"*".repeat(Math.max(0, digits.length - 7))}${digits.slice(-3)}`;
}
