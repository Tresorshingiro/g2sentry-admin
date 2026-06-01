export interface DistrictSetting {
  id: string;
  name: string;
  guardians: string;
  active: boolean;
}

export interface AppSettings {
  organisationName: string;
  contactEmail: string;
  phone: string;
  country: string;
  currency: string;
  autoDispatch: boolean;
  responseTimeoutSec: number;
  maxRetryAttempts: number;
  priorityQueue: boolean;
  baseHourlyRate: number;
  standardSurchargePct: number;
  prioritySurchargePct: number;
  emergencySurchargePct: number;
  vatRatePct: number;
  mtnMomoEnabled: boolean;
  airtelMoneyEnabled: boolean;
  invoiceDueDays: number;
  smsClientOnDispatch: boolean;
  smsGuardianOnJob: boolean;
  adminAlertsOnIncidents: boolean;
  invoiceDueReminders: boolean;
  twoFactorRequired: boolean;
  sessionTimeoutMin: number;
  districts: DistrictSetting[];
}

export const mockAppSettings: AppSettings = {
  organisationName: 'G2Sentry Rwanda Ltd',
  contactEmail: 'admin@g2sentry.rw',
  phone: '+250 788 000 000',
  country: 'Rwanda',
  currency: 'RWF — Rwandan Franc',
  autoDispatch: true,
  responseTimeoutSec: 60,
  maxRetryAttempts: 3,
  priorityQueue: true,
  baseHourlyRate: 5000,
  standardSurchargePct: 0,
  prioritySurchargePct: 20,
  emergencySurchargePct: 50,
  vatRatePct: 18,
  mtnMomoEnabled: true,
  airtelMoneyEnabled: true,
  invoiceDueDays: 7,
  smsClientOnDispatch: true,
  smsGuardianOnJob: true,
  adminAlertsOnIncidents: true,
  invoiceDueReminders: false,
  twoFactorRequired: true,
  sessionTimeoutMin: 30,
  districts: [
    { id: '1', name: 'Nyarugenge', guardians: '18 guardians', active: true },
    { id: '2', name: 'Gasabo', guardians: '14 guardians', active: true },
    { id: '3', name: 'Kicukiro', guardians: '9 guardians', active: true },
    { id: '4', name: 'Musanze', guardians: '4 guardians', active: true },
    { id: '5', name: 'Rubavu', guardians: '3 guardians', active: true },
    { id: '6', name: 'Huye', guardians: '0 guardians', active: false },
  ],
};
