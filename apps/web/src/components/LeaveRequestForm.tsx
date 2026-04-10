import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

export interface LeaveRequestFormProps {
  remainingDays?: number;
  leaveType?: string;
  defaultDates?: string;
  onSubmit?: (data: { leaveType: string; dates: string; reason: string }) => void;
  onQuickAction?: (action: string) => void;
  quickActions?: string[];
}

export function LeaveRequestForm({
  remainingDays = 18,
  leaveType = 'Annual Leave',
  defaultDates = '',
  onSubmit,
  onQuickAction,
  quickActions = ['Check holiday calendar', 'View leave history'],
}: LeaveRequestFormProps) {
  const [selectedType, setSelectedType] = useState(leaveType);
  const [dates, setDates] = useState(defaultDates);
  const [reason, setReason] = useState('');

  const leaveTypes = ['Annual Leave', 'Sick Leave', 'Personal Leave', 'Maternity Leave'];

  return (
    <div className="space-y-4 max-w-[520px]">
      {/* Form Card */}
      <div className="bg-[#F6F3F2] rounded-[20px] border border-[#E8E4E2] p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[15px] font-bold text-[#1C1B1B]">Leave Request Form</h3>
          <span className="text-[10px] font-bold text-[#716B67] uppercase tracking-[0.15em]">
            Step 1 of 2
          </span>
        </div>

        {/* Form Fields */}
        <div className="space-y-5">
          {/* Leave Type + Dates row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Leave Type */}
            <div>
              <label className="text-[10px] font-bold text-[#716B67] uppercase tracking-[0.15em] mb-2 block">
                Leave Type
              </label>
              <div className="relative">
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  className="w-full bg-white border border-[#E8E4E2] rounded-[10px] px-4 py-2.5 text-[13px] font-medium text-[#1C1B1B] focus:outline-none focus:ring-2 focus:ring-[#EC5B14]/30 appearance-none cursor-pointer pr-10"
                >
                  {leaveTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716B67] pointer-events-none" />
              </div>
            </div>

            {/* Dates */}
            <div>
              <label className="text-[10px] font-bold text-[#716B67] uppercase tracking-[0.15em] mb-2 block">
                Dates
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dates}
                  onChange={e => setDates(e.target.value)}
                  className="w-full bg-white border border-[#E8E4E2] rounded-[10px] px-4 py-2.5 text-[13px] font-medium text-[#1C1B1B] focus:outline-none focus:ring-2 focus:ring-[#EC5B14]/30 appearance-none cursor-pointer"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716B67] pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="text-[10px] font-bold text-[#716B67] uppercase tracking-[0.15em] mb-2 block">
              Reason <span className="normal-case font-medium text-[#716B67]/60">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Briefly describe the purpose..."
              rows={3}
              className="w-full bg-white border border-[#E8E4E2] rounded-[10px] px-4 py-2.5 text-[13px] font-medium text-[#1C1B1B] placeholder:text-[#716B67]/40 focus:outline-none focus:ring-2 focus:ring-[#EC5B14]/30 resize-none"
            />
          </div>
        </div>

        {/* CTA Button */}
        <div className="mt-6">
          <button
            onClick={() => onSubmit?.({ leaveType: selectedType, dates, reason })}
            className="btn-cta"
          >
            Submit to Manager
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {quickActions.map((action, i) => (
          <button
            key={i}
            onClick={() => onQuickAction?.(action)}
            className="btn-quick-action"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
