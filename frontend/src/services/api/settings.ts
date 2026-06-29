import { apiGet, apiPatch } from '@/lib/api-client';

export interface ServiceItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  hourlyRate: string;
  currency: string;
  isActive: boolean;
  requiresLicense: boolean;
}

export interface AdminProfile {
  id: string;
  phone: string;
  email: string | null;
  roles: string[];
  activeRole: string | null;
}

export async function fetchAdminProfile(): Promise<AdminProfile> {
  return apiGet<AdminProfile>('/users/me');
}

export async function updateAdminEmail(email: string): Promise<unknown> {
  return apiPatch('/users/me', { email });
}

export async function fetchDistricts(): Promise<string[]> {
  const res = await apiGet<{ districts: string[] }>('/regions/districts');
  return res.districts;
}

export async function fetchServices(): Promise<ServiceItem[]> {
  const raw = await apiGet<ServiceItem[] | { items: ServiceItem[] }>('/services');
  return Array.isArray(raw) ? raw : (raw.items ?? []);
}

/**
 * Booking policy / revenue split settings. Percentages are stored as 0–1
 * decimals on the backend (e.g. 0.15 = 15%) and are coerced to numbers here
 * since Prisma serialises Decimal columns as strings.
 */
export interface BookingSettings {
  minimumBookingHours: number;
  nightSurchargeMinPct: number;
  nightSurchargeMaxPct: number;
  holidaySurchargeMinPct: number;
  holidaySurchargeMaxPct: number;
  guardianSharePct: number;
  platformSharePct: number;
  gatewaySharePct: number;
  reserveSharePct: number;
  vatRate: number;
  updatedAt: string;
}

export type BookingSettingsPatch = Partial<Omit<BookingSettings, 'updatedAt'>>;

const BOOKING_NUMERIC_KEYS: (keyof Omit<BookingSettings, 'updatedAt'>)[] = [
  'minimumBookingHours',
  'nightSurchargeMinPct',
  'nightSurchargeMaxPct',
  'holidaySurchargeMinPct',
  'holidaySurchargeMaxPct',
  'guardianSharePct',
  'platformSharePct',
  'gatewaySharePct',
  'reserveSharePct',
  'vatRate',
];

function normalizeBookingSettings(raw: Record<string, unknown>): BookingSettings {
  const out = { updatedAt: String(raw.updatedAt ?? '') } as BookingSettings;
  for (const key of BOOKING_NUMERIC_KEYS) {
    out[key] = Number(raw[key] ?? 0);
  }
  return out;
}

export async function fetchBookingSettings(): Promise<BookingSettings> {
  const raw = await apiGet<Record<string, unknown>>('/admin/booking-settings');
  return normalizeBookingSettings(raw);
}

export async function updateBookingSettings(
  patch: BookingSettingsPatch,
): Promise<BookingSettings> {
  const raw = await apiPatch<Record<string, unknown>>('/admin/booking-settings', patch);
  return normalizeBookingSettings(raw);
}
