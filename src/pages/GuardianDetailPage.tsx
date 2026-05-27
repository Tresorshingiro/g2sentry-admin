import { Briefcase, Pencil, User, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { VettingBadge } from '@/components/shared/GuardianRosterBadges';
import { PageTopbar, TopbarButton } from '@/components/shared/PageTopbar';
import { fetchGuardianProfile } from '@/services/api';
import type { GuardianProfile } from '@/types/guardian-roster';

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-3">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
        {icon}
        <h3 className="text-[11px] font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function GuardianDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<GuardianProfile | null>(null);

  useEffect(() => {
    if (id) void fetchGuardianProfile(id).then(setProfile);
  }, [id]);

  if (!profile) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <PageTopbar title="Guardian" />
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <PageTopbar
        breadcrumb={{
          parent: 'Guardians',
          current: `${profile.name} (${profile.code})`,
        }}
      >
        <TopbarButton danger>
          <XCircle className="w-3 h-3" /> Suspend Guard
        </TopbarButton>
        <TopbarButton primary>
          <Pencil className="w-3 h-3" /> Edit Files
        </TopbarButton>
      </PageTopbar>

      <div className="p-4 grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <InfoCard
            icon={<User className="w-4 h-4 text-slate-500" />}
            title="Vetting & Personal Information"
          >
            <div className="px-3 py-1">
              {[
                ['Full Name', profile.fullName],
                ['National ID', profile.nationalId],
                ['Phone Connection', profile.phone],
                ['RNP Vetting Certificate', profile.vettingLabel],
                ['Reserve Force Status', profile.reserveForceStatus],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between py-2 border-b border-slate-50 last:border-0"
                >
                  <span className="text-[11px] text-slate-500">{k}</span>
                  {k === 'RNP Vetting Certificate' ? (
                    <VettingBadge status="VERIFIED" />
                  ) : (
                    <span
                      className={`text-[11px] font-semibold ${
                        k === 'Phone Connection'
                          ? 'text-[#14B87A]'
                          : k === 'Reserve Force Status'
                            ? 'text-amber-500'
                            : 'text-slate-900'
                      }`}
                    >
                      {v}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </InfoCard>

          <InfoCard
            icon={<Briefcase className="w-4 h-4 text-slate-500" />}
            title="Recent assignments"
          >
            <div className="px-3 py-2">
              {profile.recentAssignments.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No recent assignments.</p>
              ) : (
                profile.recentAssignments.map((a, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0"
                  >
                    <span className="text-[11px] font-medium text-slate-900">
                      {a.title}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold bg-green-100 text-green-800">
                      {a.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </InfoCard>
        </div>

        <div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-3">
            <div className="px-3.5 py-2.5 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-900">
                Operational Performance
              </h3>
            </div>
            <div className="p-3.5">
              <p className="text-2xl font-bold text-slate-900">
                {profile.rating.toFixed(2)} / 5
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Based on {profile.shiftCount} dispatched shifts
              </p>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-[#14B87A] rounded-full"
                  style={{
                    width: `${Math.min(100, (profile.rating / 5) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/guardians')}
            className="w-full text-xs text-[#14B87A] hover:underline"
          >
            ← Back to roster
          </button>
        </div>
      </div>
    </div>
  );
}
