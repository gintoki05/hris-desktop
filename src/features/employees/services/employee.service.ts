import type { EmployeeRepository } from "../repositories/employee.repository";
import type { Employee, EmployeeActor, EmployeeInput, EmployeeListFilter, EmployeePortalLinkResult } from "../types";
import { tauriEmployeeRepository } from "../repositories/tauri-employee.repository";

export function createEmployeeService(repository: EmployeeRepository) {
  return {
    listEmployees(filter: EmployeeListFilter): Promise<Employee[]> {
      return repository.listEmployees(filter);
    },

    listActiveEmployees(): Promise<Employee[]> {
      return repository.listActiveEmployees();
    },

    getEmployeeById(id: string): Promise<Employee | null> {
      return repository.getEmployeeById(id);
    },

    createEmployee(input: EmployeeInput, actor: EmployeeActor): Promise<Employee> {
      return repository.createEmployee(input, actor);
    },

    updateEmployee(id: string, input: EmployeeInput, actor: EmployeeActor): Promise<Employee> {
      return repository.updateEmployee(id, input, actor);
    },

    deactivateEmployee(id: string, actor: EmployeeActor): Promise<Employee> {
      return repository.deactivateEmployee(id, actor);
    },

    linkEmployeePortalUser(id: string, actor: EmployeeActor): Promise<EmployeePortalLinkResult> {
      return repository.linkEmployeePortalUser(id, actor);
    },
  };
}

const employeeService = createEmployeeService(tauriEmployeeRepository);

export const listEmployees = employeeService.listEmployees;
export const listActiveEmployees = employeeService.listActiveEmployees;
export const getEmployeeById = employeeService.getEmployeeById;
export const createEmployee = employeeService.createEmployee;
export const updateEmployee = employeeService.updateEmployee;
export const deactivateEmployee = employeeService.deactivateEmployee;
export const linkEmployeePortalUser = employeeService.linkEmployeePortalUser;
