import {
  AlertTriangle,
  Building2,
  Info,
  Pencil,
  Power,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageTopbar, TopbarButton } from '@/components/shared/PageTopbar';
import { fetchAssignmentById } from '@/services/api';
import type { AssignmentDetail } from '@/types/assignment';

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

function InfoRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-[11px] font-semibold text-slate-900 ${valueClass ?? ''}`}>
        {value}
      </span>
    </div>
  );
}

export function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<AssignmentDetail | null>(null);

  useEffect(() => {
    if (id) void fetchAssignmentById(id).then(setDetail);
  }, [id]);

  if (!detail) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <PageTopbar title="Assignment" />
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
          parent: 'Assignments',
          current: detail.code,
        }}
      >
        <TopbarButton danger>
          <Power className="w-3 h-3" /> Terminate Shift
        </TopbarButton>
        <TopbarButton primary>
          <Pencil className="w-3 h-3" /> Edit Detail
        </TopbarButton>
      </PageTopbar>

      <div className="p-4 grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <InfoCard
            icon={<Users className="w-4 h-4 text-slate-500" />}
            title="Assigned Security Personnel"
          >
            <div className="p-3.5">
              {detail.personnel.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No guardians assigned yet.
                </p>
              ) : (
                detail.personnel.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-slate-50 rounded-lg border border-slate-200 p-2.5 mb-2 last:mb-0"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#14B87A] text-white flex items-center justify-center text-[11px] font-bold">
                        {p.initials}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {p.code} · {p.role}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold bg-green-100 text-green-800">
                        {p.clockStatus}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {p.clockTime}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </InfoCard>

          <InfoCard
            icon={<AlertTriangle className="w-4 h-4 text-slate-500" />}
            title="Incident reports"
          >
            <p className="p-3.5 text-center text-xs text-slate-400">
              No incidents reported for this assignment.
            </p>
          </InfoCard>
        </div>

        <div>
          <InfoCard
            icon={<Info className="w-4 h-4 text-slate-500" />}
            title="Assignment Specs"
          >
            <div className="px-3">
              <InfoRow label="Location" value={detail.location} />
              <InfoRow label="Schedule" value={detail.schedule} />
              <InfoRow
                label="Priority"
                value={detail.priority.charAt(0) + detail.priority.slice(1).toLowerCase()}
                valueClass="text-red-500"
              />
              <InfoRow
                label="Guardians"
                value={`${detail.guardianCount} guardian${detail.guardianCount !== 1 ? 's' : ''}`}
              />
            </div>
          </InfoCard>

          <InfoCard
            icon={<Building2 className="w-4 h-4 text-slate-500" />}
            title="Client"
          >
            <div className="px-3">
              <InfoRow label="Business" value={detail.client} />
              <InfoRow label="TIN" value={detail.clientTin} />
              <InfoRow label="District" value={detail.clientDistrict} />
              <InfoRow
                label="Contact"
                value={detail.clientContact}
                valueClass="text-[#14B87A]"
              />
            </div>
          </InfoCard>

          <button
            type="button"
            onClick={() => navigate('/assignments')}
            className="w-full text-xs text-[#14B87A] hover:underline mt-1"
          >
            ← Back to assignments
          </button>
        </div>
      </div>
    </div>
  );
}
