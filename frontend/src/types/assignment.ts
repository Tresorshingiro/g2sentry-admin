export type AssignmentStatus =
  | 'PENDING'
  | 'DISPATCHED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';
export type AssignmentPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type AssignmentFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'PENDING'
  | 'COMPLETED'
  | 'CANCELED';

export interface Job {
  id: string;
  referenceNumber: string;
  status: AssignmentStatus;
  priority: 'URGENT' | 'HIGH' | 'STANDARD' | 'MEDIUM' | 'LOW';
  organization: { id: string; legalName: string; tin: string | null; district: string | null } | null;
  location: { id: string; name: string; district: string | null } | null;
  scheduledStart: string;
  scheduledEnd: string | null;
  requestedGuardianCount: number;
  assignedGuardians: {
    id: string;
    guardian: {
      id: string;
      guardianCode: string;
      user: { fullName: string | null; phoneNumber: string };
    };
    role: string;
    clockedInAt: string | null;
  }[];
}

export interface JobListResponse {
  items: Job[];
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}

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
