import type { EmployeeRepository } from "../repositories/employee.repository";
import type { Employee } from "../types";

export function createEmployeeService(repository: EmployeeRepository) {
  return {
    listActiveEmployees(): Promise<Employee[]> {
      return repository.listActiveEmployees();
    },

    getEmployeeById(id: string): Promise<Employee | null> {
      return repository.getEmployeeById(id);
    },
  };
}
