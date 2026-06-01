import { useEffect, useState } from 'react';
import { fetchAuditLogs, type AuditLogItem } from '@/services/api';

const LIMIT = 20;

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setFetchError(null);
    fetchAuditLogs(page, LIMIT)
      .then((res) => {
        setLogs(res.items);
        setTotal(res.meta.total);
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load audit logs');
      });
  }, [page]);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="p-4">
        {fetchError && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {fetchError}
          </div>
        )}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['When', 'Actor', 'Action', 'Entity Type', 'Entity ID'].map((h) => (
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
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {log.actor ? (log.actor.fullName ?? log.actor.phoneNumber) : 'System'}
                  </td>
                  <td className="px-4 py-3 font-medium font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{log.entityType}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs truncate max-w-[140px]">
                    {log.entityId}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-sm">
                    No audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-sm text-slate-500">
            <span>{total} total entries</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border border-slate-200 rounded-md text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page * LIMIT >= total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border border-slate-200 rounded-md text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
