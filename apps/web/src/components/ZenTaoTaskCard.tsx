import { ClipboardList, Users, Calendar, Rocket } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

export interface ZenTaoTaskCardProps {
  title: string;
  assignees?: { name: string; avatar?: string }[];
  assigneeCount?: number;
  priority?: 'High' | 'Medium' | 'Low';
  assignee?: string;
  sprintName?: string;
  sprintStartsIn?: string;
  onCreateTask?: (data: { priority: string; assignee: string }) => void;
}

export function ZenTaoTaskCard({
  title,
  assignees = [],
  assigneeCount = 0,
  priority = 'High',
  assignee = '',
  sprintName = '',
  sprintStartsIn = '',
  onCreateTask,
}: ZenTaoTaskCardProps) {
  const [selectedPriority, setSelectedPriority] = useState(priority);
  const [selectedAssignee, setSelectedAssignee] = useState(assignee);

  const priorities: Array<'High' | 'Medium' | 'Low'> = ['High', 'Medium', 'Low'];
  const priorityColors: Record<string, string> = {
    High: 'border-[#EC5B14] bg-[#EC5B14]/5 text-[#A33800]',
    Medium: 'border-[#E8E4E2] bg-white text-[#716B67]',
    Low: 'border-[#E8E4E2] bg-white text-[#716B67]',
  };

  const assigneesToShow = assignees.length > 0 ? assignees.slice(0, 2) : [];
  const remaining = assignees.length > 2 ? assignees.length - 2 : assigneeCount > 2 ? assigneeCount - 2 : 0;

  return (
    <div className="bg-white rounded-[20px] border border-[#E8E4E2] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] mt-4 max-w-[520px]">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-[#E8E4E2]/60">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 p-1.5 rounded-lg">
              <ClipboardList className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-[10px] font-bold text-[#716B67] uppercase tracking-[0.15em]">
              ZenTao Task Integration
            </span>
          </div>
          {/* Assignee avatars */}
          {assigneesToShow.length > 0 && (
            <div className="flex items-center">
              {assigneesToShow.map((a, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full bg-gradient-to-br from-[#F5C6A0] to-[#E8A87C] border-2 border-white flex items-center justify-center text-[10px] font-bold text-white -ml-2 first:ml-0"
                  title={a.name}
                >
                  {a.name.split(' ').map(n => n[0]).join('')}
                </div>
              ))}
              {remaining > 0 && (
                <div className="w-7 h-7 rounded-full bg-[#F6F3F2] border-2 border-white flex items-center justify-center text-[9px] font-bold text-[#716B67] -ml-2">
                  +{remaining}
                </div>
              )}
            </div>
          )}
        </div>
        <h3 className="text-[16px] font-bold text-[#1C1B1B] mt-2">{title}</h3>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-5">
        {/* Priority Level */}
        <div>
          <label className="text-[10px] font-bold text-[#716B67] uppercase tracking-[0.15em] mb-2 block">
            Priority Level
          </label>
          <div className="flex gap-2">
            {priorities.map(p => (
              <button
                key={p}
                onClick={() => setSelectedPriority(p)}
                className={cn(
                  'px-5 py-2 rounded-[10px] text-[13px] font-semibold border transition-all',
                  priorityColors[selectedPriority === p ? p : 'Medium']
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Assignee */}
        {assignees.length > 0 && (
          <div>
            <label className="text-[10px] font-bold text-[#716B67] uppercase tracking-[0.15em] mb-2 block">
              Primary Assignee
            </label>
            <select
              value={selectedAssignee}
              onChange={e => setSelectedAssignee(e.target.value)}
              className="w-full bg-[#F6F3F2] border border-[#E8E4E2] rounded-[10px] px-4 py-2.5 text-[13px] font-medium text-[#1C1B1B] focus:outline-none focus:ring-2 focus:ring-[#EC5B14]/30 appearance-none cursor-pointer"
            >
              {assignees.map(a => (
                <option key={a.name} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Active Sprint */}
        {sprintName && (
          <div className="bg-[#F6F3F2] rounded-[14px] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-[#716B67]" />
              <div>
                <span className="text-[10px] font-bold text-[#716B67] uppercase tracking-[0.1em]">
                  Active Sprint
                </span>
                <p className="text-[13px] font-bold text-[#1C1B1B] mt-0.5">{sprintName}</p>
              </div>
            </div>
            {sprintStartsIn && (
              <span className="text-[11px] text-[#716B67] italic">{sprintStartsIn}</span>
            )}
          </div>
        )}
      </div>

      {/* CTA Button */}
      <div className="px-6 pb-6">
        <button
          onClick={() => onCreateTask?.({ priority: selectedPriority, assignee: selectedAssignee })}
          className="btn-cta"
        >
          <Rocket className="w-4 h-4" />
          Create Task &amp; Sync to ZenTao
        </button>
      </div>
    </div>
  );
}
