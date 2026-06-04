import { mockAppSettings, type AppSettings } from '../mock/settings';

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export async function fetchAppSettings(): Promise<AppSettings> {
  await delay(200);
  return { ...mockAppSettings };
}
