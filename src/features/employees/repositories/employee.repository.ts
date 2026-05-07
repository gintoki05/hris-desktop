import type { Employee, EmployeeActor, EmployeeInput, EmployeeListFilter } from "../types";

export type EmployeeRepository = {
  listEmployees: (filter: EmployeeListFilter) => Promise<Employee[]>;
  listActiveEmployees: () => Promise<Employee[]>;
  getEmployeeById: (id: string) => Promise<Employee | null>;
  createEmployee: (input: EmployeeInput, actor: EmployeeActor) => Promise<Employee>;
  updateEmployee: (id: string, input: EmployeeInput, actor: EmployeeActor) => Promise<Employee>;
  deactivateEmployee: (id: string, actor: EmployeeActor) => Promise<Employee>;
};
