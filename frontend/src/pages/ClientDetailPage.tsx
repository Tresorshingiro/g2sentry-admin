import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchClientById } from '@/services/api';

interface Location {
  id: string;
  name: string;
  district: string | null;
  sector: string | null;
  address: string | null;
}

interface ClientDetail {
  id: string;
  legalName: string;
  tradingName: string | null;
  tinNumber: string | null;
  orgType: string | null;
  verificationStatus: string;
  createdAt: string;
  primaryDistrict: string | null;
  locations?: Location[];
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 text-sm py-1.5 border-b border-slate-50 last:border-0">
      <span className="w-44 text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

function orgTypeLabel(t: string | null): string {
  if (!t) return '—';
  return t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchClientById(id)
      .then((c) => setClient(c as ClientDetail))
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load client');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return <div className="p-6 text-red-600">{loadError}</div>;
  }

  if (!client) {
    return <div className="p-6 text-gray-500">Client not found.</div>;
  }

  const statusColor =
    client.verificationStatus === 'VERIFIED'
      ? 'bg-green-100 text-green-700'
      : client.verificationStatus === 'REJECTED'
      ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700';

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">{client.legalName}</h2>
            {client.tradingName && <p className="text-xs text-slate-400 mt-0.5">{client.tradingName}</p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>{client.verificationStatus}</span>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Organisation Details</h2>
          <Row label="Legal name" value={client.legalName} />
          <Row label="Trading name" value={client.tradingName ?? '—'} />
          <Row label="TIN number" value={client.tinNumber ?? '—'} />
          <Row label="Category" value={orgTypeLabel(client.orgType)} />
          <Row label="Primary district" value={client.primaryDistrict ?? '—'} />
          <Row label="Verification status" value={client.verificationStatus} />
          <Row label="Registered" value={new Date(client.createdAt).toLocaleDateString()} />
          {client.contactEmail && <Row label="Contact email" value={client.contactEmail} />}
          {client.contactPhone && <Row label="Contact phone" value={client.contactPhone} />}
          {client.website && <Row label="Website" value={client.website} />}
        </div>

        {client.locations && client.locations.length > 0 && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-800 mb-3">
              Locations ({client.locations.length})
            </h2>
            <div className="space-y-3">
              {client.locations.map((loc) => (
                <div key={loc.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-sm font-medium text-slate-900">{loc.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[loc.address, loc.sector, loc.district].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
