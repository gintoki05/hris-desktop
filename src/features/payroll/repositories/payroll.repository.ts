import type { PayrollPeriod, PayrollSnapshot } from "../types";

export type PayrollRepository = {
  getPeriodById: (periodId: string) => Promise<PayrollPeriod | null>;
  saveFinalizedSnapshot: (snapshot: PayrollSnapshot) => Promise<void>;
};
