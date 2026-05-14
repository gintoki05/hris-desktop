import type { PayrollComponentAmount, PayrollSnapshot } from "../types";

export type PayrollCalculationInput = {
  id: string;
  employeeId: string;
  period: PayrollSnapshot["period"];
  incomeComponents: PayrollComponentAmount[];
  deductionComponents: PayrollComponentAmount[];
  finalizedAt: string;
};

export function calculatePayrollSnapshot(input: PayrollCalculationInput): PayrollSnapshot {
  assertValidPayrollComponents(input.incomeComponents, "pendapatan");
  assertValidPayrollComponents(input.deductionComponents, "potongan");

  const grossPay = sumAmounts(input.incomeComponents);
  const totalDeductions = sumAmounts(input.deductionComponents);

  return {
    id: input.id,
    employeeId: input.employeeId,
    period: input.period,
    incomeComponents: input.incomeComponents,
    deductionComponents: input.deductionComponents,
    grossPay,
    totalDeductions,
    netPay: grossPay - totalDeductions,
    finalizedAt: input.finalizedAt,
  };
}

export function amountToIndonesianRupiahWords(amount: number): string {
  assertValidPayrollAmount(amount, "gaji bersih");

  if (amount === 0) {
    return "Nol rupiah";
  }

  return capitalizeFirstLetter(`${numberToIndonesianWords(amount)} rupiah`);
}

function assertValidPayrollComponents(
  components: PayrollComponentAmount[],
  groupLabel: string,
): void {
  for (const component of components) {
    assertValidPayrollAmount(component.amount, component.name || groupLabel);
  }
}

function assertValidPayrollAmount(amount: number, label: string): void {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    throw new Error(`Nominal ${label} harus berupa angka rupiah bulat.`);
  }

  if (amount < 0) {
    throw new Error(`Nominal ${label} tidak boleh negatif.`);
  }
}

function sumAmounts(components: PayrollComponentAmount[]): number {
  return components.reduce((total, component) => total + component.amount, 0);
}

function numberToIndonesianWords(value: number): string {
  const units = [
    "",
    "satu",
    "dua",
    "tiga",
    "empat",
    "lima",
    "enam",
    "tujuh",
    "delapan",
    "sembilan",
    "sepuluh",
    "sebelas",
  ];

  if (value < 12) {
    return units[value];
  }

  if (value < 20) {
    return `${units[value - 10]} belas`;
  }

  if (value < 100) {
    return joinWords(units[Math.floor(value / 10)], "puluh", numberToIndonesianWords(value % 10));
  }

  if (value < 200) {
    return joinWords("seratus", numberToIndonesianWords(value - 100));
  }

  if (value < 1_000) {
    return joinWords(units[Math.floor(value / 100)], "ratus", numberToIndonesianWords(value % 100));
  }

  if (value < 2_000) {
    return joinWords("seribu", numberToIndonesianWords(value - 1_000));
  }

  if (value < 1_000_000) {
    return joinWords(numberToIndonesianWords(Math.floor(value / 1_000)), "ribu", numberToIndonesianWords(value % 1_000));
  }

  if (value < 1_000_000_000) {
    return joinWords(
      numberToIndonesianWords(Math.floor(value / 1_000_000)),
      "juta",
      numberToIndonesianWords(value % 1_000_000),
    );
  }

  if (value < 1_000_000_000_000) {
    return joinWords(
      numberToIndonesianWords(Math.floor(value / 1_000_000_000)),
      "miliar",
      numberToIndonesianWords(value % 1_000_000_000),
    );
  }

  return joinWords(
    numberToIndonesianWords(Math.floor(value / 1_000_000_000_000)),
    "triliun",
    numberToIndonesianWords(value % 1_000_000_000_000),
  );
}

function joinWords(...parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}

function capitalizeFirstLetter(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
