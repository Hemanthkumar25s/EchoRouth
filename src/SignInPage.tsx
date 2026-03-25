import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, ArrowLeft, Zap } from 'lucide-react';

interface SignInPageProps {
  onLogin: () => void;
  onBack: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
}

const ROTATING_WORDS = ["Articles", "News", "Notes", "URLs"];

export default function SignInPage({ onLogin, onBack, onTerms, onPrivacy }: SignInPageProps) {
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await onLogin();
    } catch (err: any) {
      console.error("Login error:", err);
      
      let errorMessage: React.ReactNode = err.message || "An unexpected error occurred during sign-in.";
      let technicalDetails = "";

      if (err.code === 'auth/internal-error') {
        try {
          // Try to extract deeper info from the internal error
          const parsed = JSON.parse(err.message.replace('Firebase: ', ''));
          technicalDetails = JSON.stringify(parsed, null, 2);
        } catch (e) {
          technicalDetails = err.message;
        }

        errorMessage = (
          <div className="space-y-4 text-left">
            <div className="p-3 bg-red-100/50 border border-red-200 rounded-xl">
              <p className="text-red-700 font-bold mb-1">Firebase Auth Internal Error</p>
              <p className="text-red-600 text-xs leading-relaxed">This means your Google login isn't fully set up in the Firebase Console yet.</p>
            </div>

            <div className="bg-slate-900 text-slate-300 p-3 rounded-xl text-[10px] font-mono overflow-auto max-h-32">
              <p className="text-blue-400 mb-1">// Technical Details (Copy this for me):</p>
              {technicalDetails}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Visual Guide to find the Dropdown:</p>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-[10px] font-mono text-slate-500 leading-tight">
                <p className="text-blue-600 font-bold mb-2">// Firebase Console Layout:</p>
                <p>+---------------------------------------+</p>
                <p>| Google Provider Settings          [X] |</p>
                <p>|                                       |</p>
                <p>|  ( ) Enable  &lt;-- <span className="text-blue-600 font-bold">CLICK THIS (MUST BE BLUE)</span> |</p>
                <p>|                                       |</p>
                <p>|  <span className="text-slate-900 font-bold">Project support email</span>              |</p>
                <p>|  [ <span className="text-blue-600 font-bold">hemanthkumar.s3125@gmail.com ▾</span> ] |</p>
                <p>|                                       |</p>
                <p>|  [ SAVE ] &lt;-- <span className="text-blue-600 font-bold">DON'T FORGET TO CLICK THIS</span> |</p>
                <p>+---------------------------------------+</p>
              </div>
              <ol className="list-decimal ml-4 space-y-2 text-xs text-slate-600">
                <li>Go to <a href="https://console.firebase.google.com/project/echorouth-969df/authentication/providers" target="_blank" className="text-blue-600 underline">Auth Providers</a>.</li>
                <li>Click <strong>Google</strong>.</li>
                <li>If the dropdown is missing, click <a href="https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=echorouth-969df" target="_blank" className="text-blue-600 underline">THIS LINK</a> to enable the API first.</li>
                <li>Switch <strong>Enable</strong> to <strong>ON</strong>, select your email, and click <strong>Save</strong>.</li>
              </ol>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 italic">If the dropdown is still missing, ensure the <a href="https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=echorouth-969df" target="_blank" className="text-blue-400 underline">Identity Toolkit API</a> is enabled.</p>
            </div>
          </div>
        );
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = "Sign-in popup was blocked by your browser. Please allow popups for this site.";
      } else if (err.code === 'auth/cancelled-popup-request') {
        return; // User closed the popup
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 font-sans">
      <button 
        onClick={onBack}
        className="absolute top-8 left-8 text-slate-500 hover:text-slate-900 flex items-center gap-2 transition-colors z-10 font-medium"
      >
        <ArrowLeft size={20} />
        <span>Back to Home</span>
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md bg-white border border-slate-200/60 rounded-[2rem] p-8 sm:p-10 shadow-xl z-10 text-center"
      >
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20 mb-8">
          <Radio size={32} className="text-white" />
        </div>
        
        <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">
          Summarize <br />
          <div className="h-[1.2em] relative overflow-hidden inline-block align-bottom min-w-[120px]">
            <AnimatePresence mode="wait">
              <motion.span
                key={ROTATING_WORDS[index]}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.5, ease: "circOut" }}
                className="absolute left-0 right-0 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {ROTATING_WORDS[index]}
              </motion.span>
            </AnimatePresence>
          </div>
        </h2>
        <p className="text-slate-600 mb-8 text-lg">Sign in to continue to Echo<span className="text-blue-500">Routh</span></p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium text-left">
            <p className="font-bold mb-1">Sign-in Error:</p>
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button 
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-900 px-6 py-4 rounded-full font-semibold border border-slate-200 shadow-sm transition-all flex items-center justify-center gap-3 text-lg group"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              <>
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6 group-hover:scale-110 transition-transform" />
                Continue with Google
              </>
            )}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            By signing in, you agree to our <br/>
            <button onClick={onTerms} className="text-blue-600 hover:text-blue-700 transition-colors font-medium">Terms of Service</button> and <button onClick={onPrivacy} className="text-blue-600 hover:text-blue-700 transition-colors font-medium">Privacy Policy</button>.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
