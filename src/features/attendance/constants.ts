import type { AttendanceCodeCategory, OvertimeAppliesTo } from "./types";

export const ATTENDANCE_CODE_CATEGORY_OPTIONS: Array<{
  value: AttendanceCodeCategory;
  label: string;
}> = [
  { value: "present", label: "Masuk" },
  { value: "sick", label: "Sakit" },
  { value: "leave", label: "Izin/Cuti" },
  { value: "absence", label: "Alpa" },
  { value: "off", label: "Off" },
];

export const OVERTIME_APPLIES_TO_OPTIONS: Array<{ value: OvertimeAppliesTo; label: string }> = [
  { value: "workday", label: "Hari kerja" },
  { value: "holiday", label: "Hari libur" },
];
