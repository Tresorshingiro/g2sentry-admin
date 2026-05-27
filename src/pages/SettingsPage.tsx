import {
  Bell,
  Building2,
  CreditCard,
  DollarSign,
  Lock,
  MapPin,
  Save,
  Shield,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { PageTopbar, TopbarButton } from '@/components/shared/PageTopbar';
import { ToggleSwitch } from '@/components/shared/ToggleSwitch';
import { fetchAppSettings } from '@/services/api';
import type { AppSettings } from '@/services/mock/settings';
import { cn } from '@/lib/utils';

function FormSection({
  icon,
  iconBg,
  title,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-3">
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-slate-100">
        <div
          className={cn(
            'w-7 h-7 rounded-md flex items-center justify-center',
            iconBg,
          )}
        >
          {icon}
        </div>
        <h3 className="text-xs font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

function SettingRow({
  title,
  subtitle,
  children,
  first,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-2.5',
        !first && 'border-t border-slate-100',
      )}
    >
      <div className="flex-1 pr-4">
        <p className="text-xs font-medium text-slate-900">{title}</p>
        {subtitle && (
          <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
      {children}
    </p>
  );
}

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState<AppSettings | null>(null);

  useEffect(() => {
    void fetchAppSettings().then((s) => {
      setSettings(s);
      setSaved(s);
    });
  }, []);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const toggleDistrict = (id: string) => {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            districts: prev.districts.map((d) =>
              d.id === id ? { ...d, active: !d.active } : d,
            ),
          }
        : prev,
    );
  };

  const handleDiscard = () => {
    if (saved) setSettings({ ...saved });
  };

  const handleSave = () => {
    if (settings) setSaved({ ...settings });
  };

  if (!settings) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <PageTopbar title="Settings" />
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <PageTopbar title="Settings">
        <TopbarButton onClick={handleDiscard}>Discard changes</TopbarButton>
        <TopbarButton primary onClick={handleSave}>
          <Save className="w-3 h-3" /> Save changes
        </TopbarButton>
      </PageTopbar>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FormSection
              icon={<Building2 className="w-4 h-4 text-blue-500" />}
              iconBg="bg-blue-100"
              title="Organisation details"
            >
              <div className="space-y-2.5">
                <div>
                  <FieldLabel>Organisation name</FieldLabel>
                  <Input
                    value={settings.organisationName}
                    onChange={(e) =>
                      update('organisationName', e.target.value)
                    }
                    className="bg-slate-50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Contact email</FieldLabel>
                    <Input
                      type="email"
                      value={settings.contactEmail}
                      onChange={(e) => update('contactEmail', e.target.value)}
                      className="bg-slate-50"
                    />
                  </div>
                  <div>
                    <FieldLabel>Phone</FieldLabel>
                    <Input
                      value={settings.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      className="bg-slate-50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Country</FieldLabel>
                    <div className="flex h-10 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900">
                      {settings.country}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Default currency</FieldLabel>
                    <div className="flex h-10 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900">
                      {settings.currency}
                    </div>
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection
              icon={<Shield className="w-4 h-4 text-[#14B87A]" />}
              iconBg="bg-green-100"
              title="Dispatch engine"
            >
              <SettingRow
                first
                title="Auto-dispatch"
                subtitle="Automatically assign nearest available guardian when a request is submitted"
              >
                <ToggleSwitch
                  checked={settings.autoDispatch}
                  onChange={(v) => update('autoDispatch', v)}
                />
              </SettingRow>
              <SettingRow
                title="Guardian response timeout"
                subtitle="How long guardian has to accept before re-dispatching"
              >
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={settings.responseTimeoutSec}
                    onChange={(e) =>
                      update('responseTimeoutSec', Number(e.target.value))
                    }
                    className="w-16 text-center bg-slate-50"
                  />
                  <span className="text-[11px] text-slate-500">sec</span>
                </div>
              </SettingRow>
              <SettingRow
                title="Max retry attempts"
                subtitle="How many guardians to try before marking as unserviceable"
              >
                <Input
                  type="number"
                  value={settings.maxRetryAttempts}
                  onChange={(e) =>
                    update('maxRetryAttempts', Number(e.target.value))
                  }
                  className="w-16 text-center bg-slate-50"
                />
              </SettingRow>
              <SettingRow
                title="Priority queue enabled"
                subtitle="Emergency and priority jobs jump the queue and dispatch first"
              >
                <ToggleSwitch
                  checked={settings.priorityQueue}
                  onChange={(v) => update('priorityQueue', v)}
                />
              </SettingRow>
            </FormSection>

            <FormSection
              icon={<MapPin className="w-4 h-4 text-amber-500" />}
              iconBg="bg-amber-100"
              title="Active districts"
            >
              <div className="flex flex-col gap-1.5">
                {settings.districts.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div>
                      <p className="text-xs font-medium text-slate-900">
                        {d.name}
                      </p>
                      <p className="text-[10px] text-slate-500">{d.guardians}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                          d.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {d.active ? 'Active' : 'Inactive'}
                      </span>
                      <ToggleSwitch
                        checked={d.active}
                        onChange={() => toggleDistrict(d.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </FormSection>
          </div>

          <div>
            <FormSection
              icon={<DollarSign className="w-4 h-4 text-amber-500" />}
              iconBg="bg-amber-100"
              title="Pricing & rates"
            >
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <FieldLabel>Base hourly rate (RWF)</FieldLabel>
                  <Input
                    type="number"
                    value={settings.baseHourlyRate}
                    onChange={(e) =>
                      update('baseHourlyRate', Number(e.target.value))
                    }
                    className="bg-slate-50"
                  />
                </div>
                <div>
                  <FieldLabel>Standard surcharge (%)</FieldLabel>
                  <Input
                    type="number"
                    value={settings.standardSurchargePct}
                    onChange={(e) =>
                      update('standardSurchargePct', Number(e.target.value))
                    }
                    className="bg-slate-50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <FieldLabel>Priority surcharge (%)</FieldLabel>
                  <Input
                    type="number"
                    value={settings.prioritySurchargePct}
                    onChange={(e) =>
                      update('prioritySurchargePct', Number(e.target.value))
                    }
                    className="bg-slate-50"
                  />
                </div>
                <div>
                  <FieldLabel>Emergency surcharge (%)</FieldLabel>
                  <Input
                    type="number"
                    value={settings.emergencySurchargePct}
                    onChange={(e) =>
                      update('emergencySurchargePct', Number(e.target.value))
                    }
                    className="bg-slate-50"
                  />
                </div>
              </div>
              <div>
                <FieldLabel>VAT rate (%)</FieldLabel>
                <Input
                  type="number"
                  value={settings.vatRatePct}
                  onChange={(e) =>
                    update('vatRatePct', Number(e.target.value))
                  }
                  className="bg-slate-50"
                />
              </div>
            </FormSection>

            <FormSection
              icon={<CreditCard className="w-4 h-4 text-blue-500" />}
              iconBg="bg-blue-100"
              title="Payment gateways"
            >
              <SettingRow
                first
                title="MTN MoMo"
                subtitle="Connected · API key ••••••••5d2f"
              >
                <ToggleSwitch
                  checked={settings.mtnMomoEnabled}
                  onChange={(v) => update('mtnMomoEnabled', v)}
                />
              </SettingRow>
              <SettingRow
                title="Airtel Money"
                subtitle="Connected · API key ••••••••8a1c"
              >
                <ToggleSwitch
                  checked={settings.airtelMoneyEnabled}
                  onChange={(v) => update('airtelMoneyEnabled', v)}
                />
              </SettingRow>
              <div className="pt-2">
                <FieldLabel>Invoice payment due period (days)</FieldLabel>
                <Input
                  type="number"
                  value={settings.invoiceDueDays}
                  onChange={(e) =>
                    update('invoiceDueDays', Number(e.target.value))
                  }
                  className="bg-slate-50"
                />
              </div>
            </FormSection>

            <FormSection
              icon={<Bell className="w-4 h-4 text-[#14B87A]" />}
              iconBg="bg-green-100"
              title="Notifications"
            >
              <SettingRow
                first
                title="SMS to clients on dispatch"
                subtitle="Client receives SMS when guardian is dispatched"
              >
                <ToggleSwitch
                  checked={settings.smsClientOnDispatch}
                  onChange={(v) => update('smsClientOnDispatch', v)}
                />
              </SettingRow>
              <SettingRow
                title="SMS to guardian on new job"
                subtitle="Guardian receives SMS alongside in-app alert"
              >
                <ToggleSwitch
                  checked={settings.smsGuardianOnJob}
                  onChange={(v) => update('smsGuardianOnJob', v)}
                />
              </SettingRow>
              <SettingRow
                title="Admin alerts on incidents"
                subtitle="Push notification to admin when incident reported"
              >
                <ToggleSwitch
                  checked={settings.adminAlertsOnIncidents}
                  onChange={(v) => update('adminAlertsOnIncidents', v)}
                />
              </SettingRow>
              <SettingRow
                title="Invoice due reminders"
                subtitle="Remind clients 3 days before invoice due date"
              >
                <ToggleSwitch
                  checked={settings.invoiceDueReminders}
                  onChange={(v) => update('invoiceDueReminders', v)}
                />
              </SettingRow>
            </FormSection>

            <FormSection
              icon={<Lock className="w-4 h-4 text-red-500" />}
              iconBg="bg-red-100"
              title="Security & access"
            >
              <SettingRow
                first
                title="Two-factor authentication"
                subtitle="Required for all admin logins"
              >
                <ToggleSwitch
                  checked={settings.twoFactorRequired}
                  onChange={(v) => update('twoFactorRequired', v)}
                />
              </SettingRow>
              <SettingRow title="Session timeout (minutes)">
                <Input
                  type="number"
                  value={settings.sessionTimeoutMin}
                  onChange={(e) =>
                    update('sessionTimeoutMin', Number(e.target.value))
                  }
                  className="w-16 text-center bg-slate-50"
                />
              </SettingRow>
              <div className="pt-2 border-t border-slate-100 mt-2">
                <FieldLabel>Change admin password</FieldLabel>
                <Input
                  type="password"
                  placeholder="New password"
                  className="bg-slate-50 mb-2"
                />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  className="bg-slate-50"
                />
              </div>
            </FormSection>
          </div>
        </div>
      </div>
    </div>
  );
}
