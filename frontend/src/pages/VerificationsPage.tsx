import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { fetchPendingOrgs, reviewOrganization } from '@/services/api';

interface OrgItem {
  id: string;
  legalName: string;
  orgType: string;
  tinNumber: string | null;
  applicationSubmittedAt: string | null;
  verificationStatus: string;
}

export function VerificationsPage() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    void fetchPendingOrgs().then((d) => setOrgs(d as OrgItem[]));
  }, []);

  async function approveOrg(id: string) {
    try {
      await reviewOrganization(id, 'VERIFIED');
      setMsg('Organization approved.');
      setOrgs((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Approval failed');
    }
  }

  async function rejectOrg(id: string) {
    const reason = prompt('Rejection reason:');
    if (reason === null) return;
    try {
      await reviewOrganization(id, 'REJECTED', reason);
      setMsg('Organization rejected.');
      setOrgs((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Rejection failed');
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="p-4">
        {msg && (
          <div className="mb-4 px-4 py-2 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200">
            {msg}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {orgs.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No pending organization verifications.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Organization', 'Type', 'TIN', 'Submitted', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{org.legalName}</td>
                    <td className="px-4 py-3 text-slate-500">{org.orgType}</td>
                    <td className="px-4 py-3 text-slate-500">{org.tinNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {org.applicationSubmittedAt
                        ? new Date(org.applicationSubmittedAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <PermissionGate permission="admin:verification:write">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void approveOrg(org.id)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void rejectOrg(org.id)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
                          >
                            <XCircle className="w-3 h-3" /> Reject
                          </button>
                        </div>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
