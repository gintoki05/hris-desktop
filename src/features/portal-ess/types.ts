export type PortalEmployeeAccountStatus = "found" | "missing";

export type PortalEmployeeProfileStatus = "found" | "missing";

export type PortalEmployeeStatusItem = {
  employeeId: string;
  employeeName: string;
  employeeCodeMasked: string;
  employeeEmail: string;
  employeeStatus: string;
  authUserStatus: PortalEmployeeAccountStatus;
  employeeProfileStatus: PortalEmployeeProfileStatus;
  payslipCount: number;
  latestPayrollPeriod: string;
  latestPublishedAt: string | null;
  portalUserId: string;
  employeeProfileId: string;
  issueMessage: string;
};

export type PortalEmployeeStatusResult = {
  items: PortalEmployeeStatusItem[];
};

export type PortalCreateAccountResult = {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  portalUserId: string;
  employeeProfileId: string;
  accountStatus: "created" | "existing";
};

export type PortalEssActor = {
  userId: string;
  displayName: string;
  role: string;
};
