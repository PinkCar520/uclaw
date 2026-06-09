import React, { useState, useEffect } from 'react';
import { Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ToastMessage {
  id: string;
  message: string;
}

let toastListener: ((msg: ToastMessage) => void) | null = null;

export const globalToast = (message: string) => {
  if (toastListener) {
    toastListener({ id: Math.random().toString(), message });
  }
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    toastListener = (msg) => {
      setToasts(prev => [...prev, msg]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== msg.id));
      }, 3500);
    };
    return () => {
      toastListener = null;
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
            className="bg-white border border-[#E8E4E2] shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-full pl-3 pr-4 py-2.5 flex items-center gap-3 pointer-events-auto min-w-[240px]"
          >
            <div className="w-6 h-6 rounded-full border border-[#E8E4E2] flex items-center justify-center shrink-0">
              <Info className="w-3.5 h-3.5 text-[#716B67]" />
            </div>
            <span className="text-sm font-medium text-[#1C1B1B] flex-1">{t.message}</span>
            <button 
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="p-1 rounded-full hover:bg-[#F6F3F2] text-[#A8A4A1] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
