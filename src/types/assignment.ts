export type AssignmentStatus = 'ON_DUTY' | 'PENDING' | 'COMPLETED' | 'CANCELED';
export type AssignmentPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type AssignmentFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'PENDING'
  | 'COMPLETED'
  | 'CANCELED';

export interface AssignmentListItem {
  id: string;
  code: string;
  client: string;
  location: string;
  scheduleLabel: string;
  scheduleTime: string;
  priority: AssignmentPriority;
  staffing: string;
  staffingAlert?: boolean;
  status: AssignmentStatus;
}

export interface AssignedPersonnel {
  id: string;
  name: string;
  code: string;
  role: string;
  initials: string;
  clockStatus: string;
  clockTime: string;
}

export interface AssignmentDetail {
  id: string;
  code: string;
  client: string;
  clientTin: string;
  clientDistrict: string;
  clientContact: string;
  location: string;
  schedule: string;
  priority: AssignmentPriority;
  guardianCount: number;
  status: AssignmentStatus;
  personnel: AssignedPersonnel[];
}
