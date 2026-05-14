export type OrganizationReferenceItem = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

export type OrganizationMasterData = {
  departments: OrganizationReferenceItem[];
  positions: OrganizationReferenceItem[];
};

export type OrganizationMasterActor = {
  userId: string;
  displayName: string;
  role: string;
};
