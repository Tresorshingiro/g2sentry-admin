export type GuardianStatus = 'ON_DUTY' | 'AVAILABLE' | 'OFFLINE';

export interface Guardian {
  id: string;
  name: string;
  initials: string;
  district: string;
  assignmentType: string;
  status: GuardianStatus;
  lat: number;
  lng: number;
}

export interface ClientLocation {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  district?: string | null;
  organizationName?: string | null;
}
