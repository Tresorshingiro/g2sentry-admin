export type GuardianStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type GuardianVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type ShiftStatus = 'AVAILABLE' | 'BUSY' | 'PAUSED' | 'OFF_DUTY' | 'SUSPENDED';
export type GuardianFilter = 'ALL' | 'ACTIVE' | 'AVAILABLE' | 'VETTING' | 'SUSPENDED';

// Legacy badge type — maps to display values; 'REJECTED' treated same as 'PENDING'
export type GuardianRosterStatus = 'ON_DUTY' | 'AVAILABLE' | 'INACTIVE' | 'VETTING_PENDING' | 'SUSPENDED';

export interface GuardianListItem {
  id: string;
  guardianCode: string;
  status: GuardianStatus;
  verificationStatus: GuardianVerificationStatus;
  rating: string;
  districtBase: string;
  employmentType: string;
  joinedAt: string;
  shiftState: { shiftStatus: ShiftStatus; availableForJobs: boolean } | null;
  user: { id: string; phoneNumber: string; fullName: string | null; status: string };
}

export interface GuardianListResponse {
  items: GuardianListItem[];
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}

export interface GuardianProfile {
  id: string;
  name: string;
  code: string;
  fullName: string;
  nationalId: string;
  phone: string;
  district: string;
  vettingLabel: string;
  reserveForceStatus: string;
  rating: number;
  shiftCount: number;
  status: GuardianRosterStatus;
  recentAssignments: { title: string; status: string }[];
}
