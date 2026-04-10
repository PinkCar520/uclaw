import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { cn } from '../lib/utils';

interface ApprovalModalProps {
  request: {
    id: string;
    toolName: string;
    args: any;
  } | null;
  onRespond: (status: 'approved' | 'denied') => void;
  onClose: () => void;
}

export function ApprovalModal({ request, onRespond, onClose }: ApprovalModalProps) {
  if (!request) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="bg-orange-50 p-6 border-b border-orange-100 flex items-center gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm">
              <ShieldAlert className="w-6 h-6 text-[#EC5B14]" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-[#1C1B1B]">Action Requires Approval</h3>
              <p className="text-sm text-[#716B67]">The following tool needs your permission to run.</p>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div className="bg-[#F6F3F2] p-4 rounded-xl border border-[#E8E4E2]">
              <p className="text-xs font-bold text-[#A8A4A1] uppercase tracking-wider mb-1">Tool Name</p>
              <p className="font-mono text-sm text-[#1C1B1B] font-medium">{request.toolName}</p>
            </div>
            
            <div className="bg-[#F6F3F2] p-4 rounded-xl border border-[#E8E4E2]">
              <p className="text-xs font-bold text-[#A8A4A1] uppercase tracking-wider mb-1">Arguments</p>
              <pre className="font-mono text-xs text-[#1C1B1B] whitespace-pre-wrap max-h-32 overflow-auto">
                {JSON.stringify(request.args, null, 2)}
              </pre>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-[#E8E4E2] flex gap-3 bg-[#FCF9F8]">
            <button
              onClick={() => onRespond('denied')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 transition-colors"
            >
              <ShieldX className="w-4 h-4" />
              Deny
            </button>
            <button
              onClick={() => onRespond('approved')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#EC5B14] text-white font-bold text-sm hover:bg-[#d44f0e] transition-all shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              Approve
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
