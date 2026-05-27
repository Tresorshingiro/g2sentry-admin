import {
  Check,
  FileUp,
  Save,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { PageTopbar, TopbarButton } from '@/components/shared/PageTopbar';
import { cn } from '@/lib/utils';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
      {children}
    </p>
  );
}

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
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-slate-100 bg-slate-50">
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

export function GuardianRegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('Jean Mbangutse');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('+250 788 123 456');
  const [district, setDistrict] = useState('Nyarugenge');

  const checks = [
    { label: 'Full name', done: fullName.length > 0 },
    { label: 'National ID', done: nationalId.length > 0 },
    { label: 'Phone number', done: phone.length > 0 },
    { label: 'District', done: district.length > 0 },
    { label: 'Vetting documents', done: false },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const progressPct = Math.round((doneCount / checks.length) * 100);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <PageTopbar title="Register Security Guardian">
        <TopbarButton onClick={() => navigate('/guardians')}>
          <X className="w-3 h-3" /> Cancel
        </TopbarButton>
        <TopbarButton primary>
          <Save className="w-3 h-3" /> Save Registration
        </TopbarButton>
      </PageTopbar>

      <div className="p-4 grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-0">
          <FormSection
            icon={<User className="w-3.5 h-3.5 text-[#14B87A]" />}
            iconBg="bg-green-100"
            title="Profile Identity Registry"
          >
            <div className="grid grid-cols-2 gap-2.5 mb-2.5">
              <div>
                <FieldLabel>Full Identity Name</FieldLabel>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-slate-50 border-[#14B87A]"
                />
              </div>
              <div>
                <FieldLabel>National Registry ID</FieldLabel>
                <Input
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder="1 19XX X XXXXXXX X XX"
                  className="bg-slate-50"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <FieldLabel>Mobile Line Number</FieldLabel>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-slate-50 border-[#14B87A]"
                />
              </div>
              <div>
                <FieldLabel>Assigned Deployment District</FieldLabel>
                <Input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="bg-slate-50 border-[#14B87A]"
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            icon={<FileUp className="w-3.5 h-3.5 text-amber-500" />}
            iconBg="bg-amber-100"
            title="Vetting Document Verification Upload"
          >
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-5 flex flex-col items-center gap-2 bg-slate-50 cursor-pointer hover:border-[#14B87A] transition-colors">
              <FileUp className="w-6 h-6 text-slate-400" />
              <p className="text-xs font-medium text-slate-600">
                Drop files or browse for certificates
              </p>
              <p className="text-[10px] text-slate-400">
                PDF, PNG, JPG files accepted up to 10MB
              </p>
            </div>
          </FormSection>
        </div>

        <div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-900">
                Form completion
              </h3>
            </div>
            <div className="p-3.5">
              {checks.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0"
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-md flex items-center justify-center shrink-0',
                      item.done
                        ? 'bg-green-100'
                        : 'bg-slate-100 border border-slate-200',
                    )}
                  >
                    {item.done && (
                      <Check className="w-3 h-3 text-[#14B87A]" strokeWidth={3} />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs',
                      item.done ? 'text-slate-900' : 'text-slate-400',
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-[#14B87A] rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                {doneCount} of {checks.length} complete
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
