export type GuardianRosterStatus =
  | 'ON_DUTY'
  | 'AVAILABLE'
  | 'INACTIVE'
  | 'VETTING_PENDING'
  | 'SUSPENDED';

export type VettingStatus = 'VERIFIED' | 'EXPIRING' | 'PENDING';

export type GuardianFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'AVAILABLE'
  | 'VETTING'
  | 'SUSPENDED';

export interface GuardianListItem {
  id: string;
  name: string;
  code: string;
  initials: string;
  avatarClass: string;
  status: GuardianRosterStatus;
  district: string;
  shifts: number;
  rating: number;
  ratingPct: number;
  vetting: VettingStatus;
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
