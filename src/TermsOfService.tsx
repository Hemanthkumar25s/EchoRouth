import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface PolicyProps {
  onClose: () => void;
}

export default function TermsOfService({ onClose }: PolicyProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-[2.5rem] shadow-2xl relative p-10 text-left"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={24} className="text-slate-400" />
        </button>
        
        <div className="space-y-6 text-slate-600 font-medium">
          <h2 className="text-4xl font-black text-slate-900 font-display">Terms of Service</h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Last Updated: March 24, 2026</p>
          
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">1. Acceptance of Terms</h3>
            <p>By accessing or using EchoRouth, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>
          </section>
          
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">2. Use License</h3>
            <p>Permission is granted to temporarily use EchoRouth for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.</p>
          </section>
          
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">3. Disclaimer</h3>
            <p>The materials on EchoRouth are provided on an 'as is' basis. EchoRouth makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>
          </section>
          
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">4. Limitations</h3>
            <p>In no event shall EchoRouth or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use EchoRouth.</p>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}
