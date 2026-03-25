import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface PolicyProps {
  onClose: () => void;
}

export default function RefundPolicy({ onClose }: PolicyProps) {
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
          <h2 className="text-4xl font-black text-slate-900 font-display">Refund Policy</h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Last Updated: March 24, 2026</p>
          
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">1. Refund Eligibility</h3>
            <p>We offer refunds for our subscription services under specific circumstances, such as technical issues that prevent you from using the service or accidental double billing.</p>
          </section>
          
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">2. Requesting a Refund</h3>
            <p>To request a refund, please contact our support team at hemanthkumar.s3125@gmail.com within 7 days of the transaction. Please include your account details and the reason for the refund request.</p>
          </section>
          
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">3. Processing Refunds</h3>
            <p>Once your refund request is received and inspected, we will notify you of the approval or rejection of your refund. If approved, your refund will be processed, and a credit will automatically be applied to your original method of payment within a certain number of days.</p>
          </section>
          
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">4. Exceptions</h3>
            <p>Refunds are not typically provided for partial months of service or for users who have violated our Terms of Service.</p>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}
