import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface PolicyProps {
  onClose: () => void;
}

export default function PrivacyPolicy({ onClose }: PolicyProps) {
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
          <h2 className="text-4xl font-black text-slate-900 font-display">Privacy Policy</h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Last Updated: March 24, 2026</p>
          
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">1. Information We Collect</h3>
            <p>We collect information you provide directly to us when you create an account, use our services, or communicate with us. This includes your name, email address, and any content you provide for summarization.</p>
          </section>
          
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">2. How We Use Your Information</h3>
            <p>We use the information we collect to provide, maintain, and improve our services, including to process your requests, personalize your experience, and send you technical notices and support messages.</p>
          </section>
          
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">3. Data Security</h3>
            <p>We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction.</p>
          </section>
          
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">4. Third-Party Services</h3>
            <p>We use third-party services like Google Gemini for AI processing and Razorpay for payment processing. These services have their own privacy policies governing the use of your data.</p>
          </section>
          
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">5. Contact Us</h3>
            <p>If you have any questions about this Privacy Policy, please contact us at hemanthkumar.s3125@gmail.com.</p>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}
