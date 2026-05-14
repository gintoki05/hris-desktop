import { invoke } from "@tauri-apps/api/core";
import type { EmployeeRepository } from "./employee.repository";
import type {
  Employee,
  EmployeeActor,
  EmployeeInput,
  EmployeeListFilter,
  EmployeeStatus,
  EmploymentType,
  MaritalStatus,
  SalaryPaymentMethod,
  ShiftType,
} from "../types";

type EmployeeDto = {
  id: string;
  nik: string;
  whatsapp_number: string;
  email: string;
  name: string;
  hire_date: string;
  npwp: string;
  marital_status: MaritalStatus;
  dependents: number;
  department: string;
  position: string;
  status: EmployeeStatus;
  employment_type: EmploymentType;
  salary_amount: number;
  payment_method: SalaryPaymentMethod;
  pph21_enabled: boolean;
  shift_type: ShiftType;
  work_schedule: string;
  updated_at: string;
};

type EmployeeInputDto = Omit<EmployeeDto, "id" | "updated_at">;

type EmployeeActorDto = {
  user_id: string;
  display_name: string;
  role: string;
};

type EmployeeListFilterDto = {
  query: string | null;
  include_inactive: boolean;
};

const browserPreviewEmployees: Employee[] = [];

export const tauriEmployeeRepository: EmployeeRepository = {
  async listEmployees(filter) {
    if (!isTauriRuntime()) {
      const query = filter.query.trim().toLowerCase();
      return browserPreviewEmployees.filter((employee) => {
        if (!filter.includeInactive && employee.status === "inactive") {
          return false;
        }

        return (
          query === ""
          || employee.name.toLowerCase().includes(query)
          || employee.nik.toLowerCase().includes(query)
          || employee.department.toLowerCase().includes(query)
          || employee.position.toLowerCase().includes(query)
        );
      });
    }

    const dto = await invoke<EmployeeDto[]>("list_employees", {
      filter: toEmployeeListFilterDto(filter),
    });
    return dto.map(toEmployee);
  },

  async listActiveEmployees() {
    return tauriEmployeeRepository.listEmployees({ query: "", includeInactive: false });
  },

  async getEmployeeById(id) {
    const employees = await tauriEmployeeRepository.listEmployees({ query: "", includeInactive: true });
    return employees.find((employee) => employee.id === id) ?? null;
  },

  async createEmployee(input, actor) {
    ensureTauriRuntime();
    const dto = await invoke<EmployeeDto>("create_employee", {
      input: toEmployeeInputDto(input),
      actor: toEmployeeActorDto(actor),
    });
    return toEmployee(dto);
  },

  async updateEmployee(id, input, actor) {
    ensureTauriRuntime();
    const dto = await invoke<EmployeeDto>("update_employee", {
      id,
      input: toEmployeeInputDto(input),
      actor: toEmployeeActorDto(actor),
    });
    return toEmployee(dto);
  },

  async deactivateEmployee(id, actor) {
    ensureTauriRuntime();
    const dto = await invoke<EmployeeDto>("deactivate_employee", {
      id,
      actor: toEmployeeActorDto(actor),
    });
    return toEmployee(dto);
  },
};

function toEmployee(dto: EmployeeDto): Employee {
  return {
    id: dto.id,
    nik: dto.nik,
    whatsappNumber: dto.whatsapp_number,
    email: dto.email,
    name: dto.name,
    hireDate: dto.hire_date,
    npwp: dto.npwp,
    maritalStatus: dto.marital_status,
    dependents: dto.dependents,
    department: dto.department,
    position: dto.position,
    status: dto.status,
    employmentType: dto.employment_type,
    salaryAmount: dto.salary_amount,
    paymentMethod: dto.payment_method,
    pph21Enabled: dto.pph21_enabled,
    shiftType: dto.shift_type,
    workSchedule: dto.work_schedule,
    updatedAt: dto.updated_at,
  };
}

function toEmployeeInputDto(input: EmployeeInput): EmployeeInputDto {
  return {
    nik: input.nik,
    whatsapp_number: input.whatsappNumber,
    email: input.email,
    name: input.name,
    hire_date: input.hireDate,
    npwp: input.npwp,
    marital_status: input.maritalStatus,
    dependents: input.dependents,
    department: input.department,
    position: input.position,
    status: input.status,
    employment_type: input.employmentType,
    salary_amount: input.salaryAmount,
    payment_method: input.paymentMethod,
    pph21_enabled: input.pph21Enabled,
    shift_type: input.shiftType,
    work_schedule: input.workSchedule,
  };
}

function toEmployeeActorDto(actor: EmployeeActor): EmployeeActorDto {
  return {
    user_id: actor.userId,
    display_name: actor.displayName,
    role: actor.role,
  };
}

function toEmployeeListFilterDto(filter: EmployeeListFilter): EmployeeListFilterDto {
  const query = filter.query.trim();
  return {
    query: query === "" ? null : query,
    include_inactive: filter.includeInactive,
  };
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__?.invoke === "function";
}

function ensureTauriRuntime(): void {
  if (!isTauriRuntime()) {
    throw new Error("Data karyawan hanya bisa disimpan saat aplikasi berjalan sebagai desktop app.");
  }
}
