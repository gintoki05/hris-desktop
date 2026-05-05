import type { Employee } from "../types";

export type EmployeeRepository = {
  listActiveEmployees: () => Promise<Employee[]>;
  getEmployeeById: (id: string) => Promise<Employee | null>;
};
