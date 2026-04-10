import { BugCard } from './BugCard';
import { PipelineCard } from './PipelineCard';
import { TaskPlan } from './TaskPlan';
import { ZenTaoTaskCard } from './ZenTaoTaskCard';
import { LeaveRequestForm } from './LeaveRequestForm';
import { DiffViewer } from './DiffViewer';
import { PrintConsole } from './PrintConsole';
import { ThinkingPills } from './ThinkingPills';
import { ThinkingList } from './ThinkingList';

export function UIGallery() {
  return (
    <div className="p-10 space-y-16 overflow-y-auto h-full bg-[#fcf9f8]">
      <header>
        <h2 className="text-2xl font-bold text-[#1C1B1B]">Stitch Design Gallery</h2>
        <p className="text-[#716B67] text-sm mt-1">Visual regression testing for all Stitch-designed components.</p>
      </header>

      {/* 0. Thinking Pills */}
      <section className="space-y-6">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#EC5B14] border-b border-[#E8E4E2] pb-2">0. Thinking Pills</h3>
        <div className="space-y-4">
          {/* Active state */}
          <div className="bg-white rounded-[16px] p-6 border border-[#E8E4E2]">
            <span className="text-[10px] text-[#716B67] font-bold uppercase tracking-[0.15em]">Pills (Active)</span>
            <ThinkingPills
              steps={[
                { label: 'Checking ZenTao project board', status: 'done' },
                { label: 'Fetching member availability', status: 'active' },
                { label: 'Optimizing allocation', status: 'pending' },
              ]}
            />
          </div>

          {/* All done */}
          <div className="bg-white rounded-[16px] p-6 border border-[#E8E4E2]">
            <span className="text-[10px] text-[#716B67] font-bold uppercase tracking-[0.15em]">Pills (All Done)</span>
            <ThinkingPills
              steps={[
                { label: 'Locating report.pdf', status: 'done' },
                { label: 'Checking Printer-03 status', status: 'done' },
              ]}
            />
          </div>

          {/* List variant */}
          <div className="max-w-[400px]">
            <span className="text-[10px] text-[#716B67] font-bold uppercase tracking-[0.15em] mb-2 block">List Variant</span>
            <ThinkingList
              steps={[
                { label: 'Reading gitlab-api-v4.ts...', status: 'done' },
                { label: 'Comparing against OAuth 2.1 best practices...', status: 'done' },
                { label: 'Identifying potential token leakage in logs...', status: 'active' },
              ]}
            />
          </div>
        </div>
      </section>

      {/* 1. ZenTao Task Integration Card */}
      <section className="space-y-6">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#EC5B14] border-b border-[#E8E4E2] pb-2">1. ZenTao Task Integration (Stitch 图1)</h3>
        <div className="space-y-6">
          <ZenTaoTaskCard
            title="Authentication Refactor"
            assignees={[
              { name: 'Sarah Chen', avatar: '' },
              { name: 'Marcus Thorne', avatar: '' },
            ]}
            assigneeCount={4}
            priority="High"
            assignee="Sarah Chen"
            sprintName="Sprint 24: Q3 Security Overhaul"
            sprintStartsIn="Starts in 12h"
            onCreateTask={(data) => alert(`Created: ${JSON.stringify(data)}`)}
          />
        </div>
      </section>

      {/* 2. Leave Request Form */}
      <section className="space-y-6">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#EC5B14] border-b border-[#E8E4E2] pb-2">2. Leave Request Form (Stitch 图2)</h3>
        <LeaveRequestForm
          remainingDays={18}
          defaultDates="2023-10-23"
          onSubmit={(data) => alert(`Submitted: ${JSON.stringify(data)}`)}
          onQuickAction={(action) => alert(`Quick action: ${action}`)}
        />
      </section>

      {/* 3. Code Diff Viewer */}
      <section className="space-y-6">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#EC5B14] border-b border-[#E8E4E2] pb-2">3. Code Diff Viewer (Stitch 图3)</h3>
        <DiffViewer
          fileName="gitlab-api-v4.ts"
          draft
          diff={[
            { lineNumber: 24, type: 'context', content: "const authHeader = `Bearer ${token}`;" },
            { lineNumber: 25, type: 'deletion', content: "console.log(`Request sent with ${authHeader}`);" },
            { lineNumber: 25, type: 'addition', content: "logger.debug('Request sent', { correlationId }); // Redact tokens" },
            { lineNumber: 26, type: 'context', content: "return await fetch(url, { headers: { authHeader } });" },
          ]}
          onApply={() => alert('Applying fix to GitLab...')}
        />
      </section>

      {/* 4. Print Console */}
      <section className="space-y-6">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#EC5B14] border-b border-[#E8E4E2] pb-2">4. Print Console (Stitch 图4)</h3>
        <PrintConsole
          printerName="OfficeJet X-900"
          location="Floor 03"
          status="online"
          paperPercent={92}
          paperTray="Tray 1: Loaded"
          inkLevels={{ c: 85, m: 70, y: 90, k: 60 }}
          documentName="Q4_Financial_Summary.pdf"
          documentPages={12}
          documentSize="4.2 MB"
          documentGenerated="2h ago"
          securityPass
          securityMessage="This document contains sensitive financial data. Printing is restricted to authorized 3rd floor personnel only."
          onConfirmPrint={() => alert('Printing...')}
          onQuickAction={(action) => alert(`Print action: ${action}`)}
        />
      </section>
    </div>
  );
}
