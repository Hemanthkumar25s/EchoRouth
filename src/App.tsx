import React, { useState, useRef, useEffect } from 'react';
import { Play, Loader2, Radio, FileText, Plus, Trash2, LogIn, LogOut, Settings, Clock, ListMusic, User as UserIcon, Rss, Crown, Check, Sparkles, ArrowRight, Globe, HelpCircle, X, Shield, Zap, CheckCircle2, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateAudioFromScript } from './services/audioService';
import { auth, db, loginWithGoogle, logout, testFirestoreConnection, googleProvider } from './firebase';
import { onAuthStateChanged, User, RecaptchaVerifier, signInWithPhoneNumber, linkWithPhoneNumber, linkWithPopup } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, where, orderBy, serverTimestamp, getDoc, increment, getDocFromServer } from 'firebase/firestore';
import LandingPage from './LandingPage';
import SignInPage from './SignInPage';
import PrivacyPolicy from './PrivacyPolicy';
import TermsOfService from './TermsOfService';
import RefundPolicy from './RefundPolicy';
import { ErrorBoundary } from './components/ErrorBoundary';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Podcast {
  id: string;
  userId: string;
  title: string;
  script: string;
  tone: string;
  length: string;
  language?: string;
  createdAt: any;
}

interface UserProfile {
  uid: string;
  generationCount?: number;
  isPremium?: boolean;
  phoneNumber?: string;
  email?: string;
}

const ROTATING_WORDS = ["Articles", "News", "Notes", "URLs"];
const LIBRARY_WORDS = ["Library", "Collection", "Archive", "Episodes"];

const COUNTRIES = [
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+1', name: 'US/Canada', flag: '🇺🇸' },
  { code: '+44', name: 'UK', flag: '🇬🇧' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+971', name: 'UAE', flag: '🇦🇪' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
  { code: '+94', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩' },
  { code: '+977', name: 'Nepal', flag: '🇳🇵' },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰' },
];


function PhoneVerification({ onVerified }: { onVerified: (phone: string) => void }) {
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');

  const setupRecaptcha = () => {
    if ((window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier.clear();
      } catch (e) {
        console.error("Error clearing existing reCAPTCHA:", e);
      }
      (window as any).recaptchaVerifier = null;
    }
    
    (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'callback': () => {
        // reCAPTCHA solved
      }
    });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val.startsWith('+')) {
      // Sort by length descending to match longer codes first (e.g. +880 before +8)
      const sortedCountries = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length);
      const matchedCountry = sortedCountries.find(c => val.startsWith(c.code));
      if (matchedCountry) {
        setCountryCode(matchedCountry.code);
        val = val.slice(matchedCountry.code.length).trim();
      }
    }
    // Only allow digits, spaces, and hyphens in the local number part
    setPhoneNumber(val.replace(/[^\d\s-]/g, ''));
  };

  const handleSendOtp = async () => {
    const rawNumber = phoneNumber.replace(/\D/g, '');
    if (!rawNumber || rawNumber.length < 7) {
      setError('Please enter a valid phone number.');
      return;
    }
    const fullNumber = `${countryCode}${rawNumber}`;
    
    setLoading(true);
    setError(null);
    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      let confirmationResult;
      
      if (auth.currentUser) {
        // If user is already logged in (e.g. via Google), link the phone number
        confirmationResult = await linkWithPhoneNumber(auth.currentUser, fullNumber, appVerifier);
      } else {
        // Fallback to sign in if no user is logged in (though App.tsx logic usually ensures a user is present)
        confirmationResult = await signInWithPhoneNumber(auth, fullNumber, appVerifier);
      }
      
      (window as any).confirmationResult = confirmationResult;
      setStep('otp');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/credential-already-in-use') {
        setError('This phone number is already linked to another account. Please use a different number.');
      } else {
        setError(err.message || 'Failed to send OTP. Please try again.');
      }
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const confirmationResult = (window as any).confirmationResult;
      await confirmationResult.confirm(otp);
      
      const rawNumber = phoneNumber.replace(/\D/g, '');
      const fullNumber = `${countryCode}${rawNumber}`;
      onVerified(fullNumber);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/credential-already-in-use') {
        setError('This phone number is already linked to another account. Please use a different number.');
        setStep('phone'); // Go back so they can enter a different number
      } else {
        setError('Invalid OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[3rem] p-8 sm:p-12 max-w-md w-full shadow-2xl border border-slate-100 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-2 rotate-3 shadow-inner">
            <Shield size={40} />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-black font-display text-slate-900 leading-tight">Secure Your Account</h2>
            <p className="text-slate-500 font-medium px-4">
              {step === 'phone' 
                ? "Verify your phone number to unlock premium features and secure payments." 
                : `Enter the 6-digit code sent to ${countryCode} ${phoneNumber}`}
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold border border-red-100"
            >
              {error}
            </motion.div>
          )}

          {step === 'phone' ? (
            <div className="space-y-4">
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Phone Number</label>
                <div className="flex gap-2">
                  <div className="relative w-[110px] shrink-0">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-full pl-4 pr-8 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-700 text-lg appearance-none transition-all cursor-pointer"
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
                  <input 
                    type="tel" 
                    placeholder="98765 43210"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-700 text-xl transition-all"
                  />
                </div>
              </div>
              <button 
                onClick={handleSendOtp}
                disabled={loading || !phoneNumber}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white py-6 rounded-[2rem] font-black text-xl shadow-2xl shadow-slate-900/30 transition-all flex items-center justify-center gap-3 group"
              >
                {loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    Send OTP
                    <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Verification Code</label>
                <input 
                  type="text" 
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-black text-slate-900 text-center text-3xl tracking-[0.4em] transition-all"
                />
              </div>
              <button 
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-6 rounded-[2rem] font-black text-xl shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    Verify & Continue
                    <CheckCircle2 size={24} />
                  </>
                )}
              </button>
              <button 
                onClick={() => setStep('phone')}
                className="text-slate-400 font-bold text-sm hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
              >
                <X size={14} /> Change Number
              </button>
            </div>
          )}
          <div id="recaptcha-container" className="hidden"></div>
          
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pt-4">
            Secured by Firebase Authentication
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const [isDomainBlocked, setIsDomainBlocked] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('commutecast')) {
      setIsDomainBlocked(true);
      // Wipe the body to ensure no other components render
      document.body.innerHTML = '';
      document.body.style.background = '#f8fafc';
    }
  }, []);

  if (isDomainBlocked) {
    return (
      <div style={{ 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        textAlign: 'center',
        background: '#f8fafc',
        color: '#1e293b',
        padding: '24px'
      }}>
        <div style={{ 
          background: 'white',
          padding: '48px',
          borderRadius: '32px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
          border: '1px solid #e2e8f0',
          maxWidth: '550px',
          width: '100%'
        }}>
          <div style={{ 
            width: '64px',
            height: '64px',
            background: '#fee2e2',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <Shield size={32} color="#ef4444" />
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '16px', color: '#0f172a', letterSpacing: '-0.025em' }}>EchoRouth</h1>
          <p style={{ fontSize: '1.25rem', lineHeight: 1.6, color: '#475569', marginBottom: '32px', fontWeight: 500 }}>
            This service has been rebranded and the old "CommuteCast" URL is now permanently disabled.
          </p>
          <div style={{ background: '#f1f5f9', padding: '20px', borderRadius: '16px', marginBottom: '32px' }}>
            <p style={{ fontSize: '0.95rem', color: '#64748b', margin: 0 }}>
              To protect your security and payment integrations, we have moved to a new official domain.
            </p>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Please use the updated URL from your dashboard.
          </p>
        </div>
      </div>
    );
  }

  const [user, setUser] = useState<User | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const [hasVerifiedPhone, setHasVerifiedPhone] = useState(() => {
    return localStorage.getItem('hasVerifiedPhone') === 'true';
  });
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [articles, setArticles] = useState<string[]>(['']);
  const [tone, setTone] = useState('conversational');
  const [length, setLength] = useState('medium');
  const [language, setLanguage] = useState('English');
  const [digestTopics, setDigestTopics] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [currentAudioSrc, setCurrentAudioSrc] = useState<string | null>(null);
  const [currentScript, setCurrentScript] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string>('');
  
  const [savedPodcasts, setSavedPodcasts] = useState<Podcast[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  const [copiedRss, setCopiedRss] = useState(false);
  const [showRssHelp, setShowRssHelp] = useState(false);
  const [activePolicy, setActivePolicy] = useState<'privacy' | 'terms' | 'refund' | null>(null);
  const [isFirestoreOffline, setIsFirestoreOffline] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isRecurring, setIsRecurring] = useState(true);

  const loadDemoText = () => {
    setArticles([
      "In a historic milestone for space exploration, SpaceX successfully caught the first-stage Super Heavy booster of its Starship rocket using the 'Mechazilla' launch tower's giant mechanical arms. This unprecedented maneuver marks a massive leap toward fully reusable rockets, potentially reducing the cost of space travel by orders of magnitude. Meanwhile, NASA has announced new funding for lunar habitats, signaling a renewed global space race."
    ]);
    setTone('conversational');
    setLength('short');
    setLanguage('English');
  };
  
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let userUnsubscribe: (() => void) | null = null;

    // Initial connection test
    testFirestoreConnection().then(success => {
      if (!success) setIsFirestoreOffline(true);
    });

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
      }

      if (currentUser) {
        if (currentUser.phoneNumber) {
          localStorage.setItem('hasVerifiedPhone', 'true');
          setHasVerifiedPhone(true);
        }
        setIsProfileLoading(true);

        const userRef = doc(db, 'users', currentUser.uid);
        try {
          // Use getDocFromServer for initial check to detect offline state early
          const userSnap = await getDocFromServer(userRef).catch(err => {
            if (err.message?.includes('offline')) {
              setIsFirestoreOffline(true);
            }
            return getDoc(userRef); // Fallback to cache if server fails but not offline
          });
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              phoneNumber: currentUser.phoneNumber || null,
              generationCount: 0,
              isPremium: false,
              createdAt: serverTimestamp()
            }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'users/' + currentUser.uid));
          } else {
            // If user exists but phoneNumber is missing in Firestore, sync it from Auth
            const data = userSnap.data();
            if (!data?.phoneNumber && currentUser.phoneNumber) {
              await setDoc(userRef, { phoneNumber: currentUser.phoneNumber }, { merge: true })
                .catch(err => console.error("Error syncing phone number:", err));
            }
          }
          
          // Listen to user profile changes
          userUnsubscribe = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
              const data = doc.data() as UserProfile;
              setUserProfile(data);
              if (data.phoneNumber) {
                localStorage.setItem('hasVerifiedPhone', 'true');
                setHasVerifiedPhone(true);
              }
            }
            setIsProfileLoading(false);
          }, (err) => {
            console.error("Error fetching user profile:", err);
            setIsProfileLoading(false);
            if (err.message?.includes('insufficient permissions')) {
              handleFirestoreError(err, OperationType.GET, 'users/' + currentUser.uid);
            }
          });
        } catch (err) {
          console.error("Error accessing user profile:", err);
          setIsProfileLoading(false);
          if (err instanceof Error && err.message.includes('offline')) {
            setIsFirestoreOffline(true);
          } else {
            handleFirestoreError(err, OperationType.GET, 'users/' + currentUser.uid);
          }
        }
      } else {
        setUserProfile(null);
        setIsProfileLoading(false);
        localStorage.removeItem('hasVerifiedPhone');
        setHasVerifiedPhone(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (userUnsubscribe) {
        userUnsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (isAuthReady && user) {
      const q = query(
        collection(db, 'podcasts'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const podcastsData: Podcast[] = [];
        snapshot.forEach((doc) => {
          podcastsData.push({ id: doc.id, ...doc.data() } as Podcast);
        });
        setSavedPodcasts(podcastsData);
      }, (err) => {
        console.error("Error fetching podcasts:", err);
        handleFirestoreError(err, OperationType.LIST, 'podcasts');
      });
      
      return () => unsubscribe();
    } else {
      setSavedPodcasts([]);
    }
  }, [user, isAuthReady]);

  const handleAddArticle = () => setArticles([...articles, '']);

  const handleRemoveArticle = (index: number) => {
    const newArticles = [...articles];
    newArticles.splice(index, 1);
    if (newArticles.length === 0) newArticles.push('');
    setArticles(newArticles);
  };

  const handleArticleChange = (index: number, value: string) => {
    const newArticles = [...articles];
    newArticles[index] = value;
    setArticles(newArticles);
  };


  const handlePhoneVerified = async (phoneNumber: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { phoneNumber }, { merge: true });
      localStorage.setItem('hasVerifiedPhone', 'true');
      setHasVerifiedPhone(true);
    } catch (err) {
      console.error("Error saving phone number:", err);
      alert("Failed to save phone number. Please try again.");
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      setShowSignIn(true);
      return;
    }
    try {
      const response = await fetch('/api/create-razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, couponCode, isRecurring })
      });
      const data = await response.json();
      
      if (data.mock) {
        // Mock flow if keys are missing or 100% discount
        await setDoc(doc(db, 'users', user.uid), { isPremium: true }, { merge: true })
          .catch(err => handleFirestoreError(err, OperationType.WRITE, 'users/' + user.uid));
        alert(data.message || `Mock payment successful! You now have unlimited access. (₹${data.amount || 100})`);
        setShowUpgradeModal(false);
        return;
      }

      if (data.orderId || data.subscriptionId) {
        const options = {
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          name: "EchoRouth",
          description: data.isSubscription ? "EchoRouth Premium Subscription (Auto-Pay Setup)" : (data.discountApplied ? "EchoRouth Premium Subscription (Discount Applied)" : "EchoRouth Premium Subscription (Unlimited Generations)"),
          order_id: data.orderId,
          subscription_id: data.subscriptionId,
          handler: async function (response: any) {
            // In a real app, you should verify this signature on the backend
            // For this MVP, we will unlock premium immediately upon success callback
            await setDoc(doc(db, 'users', user.uid), { isPremium: true }, { merge: true })
              .catch(err => handleFirestoreError(err, OperationType.WRITE, 'users/' + user.uid));
            alert(data.isSubscription ? 'Auto-pay setup successful! You now have unlimited access.' : 'Payment successful! You now have unlimited access.');
            setShowUpgradeModal(false);
          },
          prefill: {
            name: user.displayName || '',
            email: user.email || '',
            contact: userProfile?.phoneNumber || user.phoneNumber || ''
          },
          config: {
            display: {
              blocks: {
                upi: {
                  name: "Pay via UPI",
                  instruments: [
                    { method: "upi" }
                  ]
                },
                other: {
                  name: "Other Payment Modes",
                  instruments: [
                    { method: "card" },
                    { method: "netbanking" },
                    { method: "wallet" }
                  ]
                }
              },
              sequence: ["block.upi", "block.other"],
              preferences: {
                show_default_blocks: false
              }
            }
          },
          theme: {
            color: "#4f46e5" // Indigo 600
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          console.error('payment.failed', response.error);
          setError(`Payment failed: ${response.error.description}`);
        });
        rzp.open();
      } else {
        throw new Error(data.error || 'Failed to create Razorpay order');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to initiate subscription');
    }
  };

  const handleGenerateDigest = async () => {
    if (!digestTopics.trim()) return;
    
    // Set the input to a prompt that triggers the Google Search tool
    const digestPrompt = `Please fetch today's latest news and updates about the following topics: ${digestTopics}. Create a daily commute digest podcast summarizing the most important points.`;
    
    setArticles([digestPrompt]);
    setLength('medium');
    setTone('conversational');
    
    // We can directly call handleGenerate since it uses the input state
    // But since setState is async, we should pass the prompt directly to a modified handleGenerate or just call it after a tiny delay
    setTimeout(() => {
      handleGenerate(digestPrompt);
    }, 100);
  };

  const handleGenerate = async (overrideInput?: string) => {
    if (!user || !userProfile) {
      setError('Please sign in to generate and save podcasts.');
      return;
    }

    // Paywall Check
    const count = userProfile.generationCount || 0;
    if (!userProfile.isPremium && count >= 3) {
      setError('You have reached your limit of 3 free generations. Please subscribe for unlimited access.');
      return;
    }

    const validArticles = overrideInput ? [overrideInput] : articles.filter(a => a.trim() !== '');
    if (validArticles.length === 0) {
      setError('Please enter at least one article or topic.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCurrentAudioSrc(null);
    setCurrentScript(null);
    setCurrentTitle(null);

    try {
      setProgressText('Analyzing inputs...');
      
      // Smart URL Scraping
      const processedArticles = await Promise.all(validArticles.map(async (article) => {
        if (article.trim().startsWith('http')) {
          try {
            setProgressText(`Scraping URL...`);
            const res = await fetch('/api/scrape', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: article.trim() })
            });
            if (res.ok) {
              const data = await res.json();
              return `Title: ${data.title}\n\nContent: ${data.content}`;
            }
          } catch (e) {
            console.warn('Failed to scrape URL, falling back to raw URL', e);
          }
        }
        return article;
      }));

      setProgressText('Writing podcast script...');
      const combinedInput = processedArticles.map((a, i) => `Article ${i + 1}:\n${a}`).join('\n\n');

      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          input: combinedInput,
          tone,
          length,
          language,
          isPremium: userProfile.isPremium
        })
      });

      if (!genRes.ok) {
        const errData = await genRes.json();
        if (errData.requiresUpgrade) {
          throw new Error('You have reached the free trial limit for this device/IP. Please upgrade to Premium to continue.');
        }
        throw new Error(errData.error || 'Failed to generate podcast');
      }

      const { script: generatedScript, title: generatedTitle } = await genRes.json();
      
      setCurrentScript(generatedScript);
      setCurrentTitle(generatedTitle);

      setIsGenerating(false);
      setIsGeneratingAudio(true);
      setProgressText('Generating audio...');
      
      try {
        const audioUrl = await generateAudioFromScript(generatedScript);
        
        setCurrentAudioSrc(audioUrl);
        
        // Save to Firestore
        const podcastId = crypto.randomUUID();
        await setDoc(doc(db, 'podcasts', podcastId), {
          id: podcastId,
          userId: user.uid,
          title: generatedTitle,
          script: generatedScript,
          tone,
          length,
          language,
          createdAt: serverTimestamp()
        });
        
        // Increment generation count for free users
        if (!userProfile.isPremium) {
          await setDoc(doc(db, 'users', user.uid), {
            generationCount: increment(1)
          }, { merge: true });
        }
      } catch (audioErr: any) {
        console.error('Error generating audio:', audioErr);
        setError('Script generated successfully, but audio generation failed: ' + (audioErr.message || 'Unknown error'));
      } finally {
        setIsGeneratingAudio(false);
        setProgressText('');
      }
    } catch (err: any) {
      console.error('Error generating podcast:', err);
      let errorMessage = err.message || 'An unexpected error occurred while generating the podcast.';
      
      // Make Gemini quota errors more user-friendly
      if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
        errorMessage = "API Quota Exceeded: " + errorMessage;
      }
      
      setError(errorMessage);
      setIsGenerating(false);
      setProgressText('');
    }
  };

  const handlePlaySaved = async (podcast: Podcast) => {
    setIsGeneratingAudio(true);
    setError(null);
    setCurrentAudioSrc(null);
    setCurrentScript(podcast.script);
    setCurrentTitle(podcast.title);
    setActiveTab('create');
    
    try {
      setProgressText('Re-generating audio from saved script...');
      const audioUrl = await generateAudioFromScript(podcast.script);
      setCurrentAudioSrc(audioUrl);
    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message || 'Failed to play saved podcast.';
      
      if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
        errorMessage = "API Quota Exceeded: " + errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setIsGeneratingAudio(false);
      setProgressText('');
    }
  };

  const copyRssUrl = () => {
    if (!user) return;
    const url = `${window.location.origin}/api/feed/${user.uid}`;
    navigator.clipboard.writeText(url);
    setCopiedRss(true);
    setTimeout(() => setCopiedRss(false), 2000);
  };

  if (isFirestoreOffline) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-100 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="text-red-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Connection Error</h1>
          <p className="text-gray-600 mb-6">
            We could not reach the database. This usually means the Firebase configuration is incorrect or the database is not provisioned.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-amber-800 font-medium mb-1">Checklist for Developers:</p>
            <ul className="text-xs text-amber-700 list-disc list-inside space-y-1">
              <li>Verify <code className="bg-amber-100 px-1 rounded">projectId</code> in <code className="bg-amber-100 px-1 rounded">firebase-applet-config.json</code></li>
              <li>Verify <code className="bg-amber-100 px-1 rounded">firestoreDatabaseId</code> is correct</li>
              <li>Ensure Firestore is provisioned in the Firebase Console</li>
              <li>Check if the API Key is valid and has Firestore enabled</li>
            </ul>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-indigo-200"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthReady || (isProfileLoading && !hasVerifiedPhone)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="text-indigo-500" size={40} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    if (showTerms) {
      return <TermsOfService onClose={() => setShowTerms(false)} />;
    }
    if (showPrivacy) {
      return <PrivacyPolicy onClose={() => setShowPrivacy(false)} />;
    }
    if (showSignIn) {
      return (
        <SignInPage 
          onLogin={loginWithGoogle} 
          onBack={() => setShowSignIn(false)} 
          onTerms={() => setShowTerms(true)}
          onPrivacy={() => setShowPrivacy(true)}
        />
      );
    }
    return <LandingPage onLogin={() => setShowSignIn(true)} />;
  }

  const generationsLeft = userProfile ? Math.max(0, 3 - (userProfile.generationCount || 0)) : 3;

  return (
    <ErrorBoundary>
    {user && isAuthReady && !hasVerifiedPhone && !isProfileLoading && (!userProfile || !userProfile.phoneNumber) && (
      <PhoneVerification onVerified={handlePhoneVerified} />
    )}
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-20">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('create')}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
              <Radio size={22} className="text-white" />
            </div>
            <span className="text-xl font-black tracking-tighter text-slate-900 font-display">
              Echo<span className="text-blue-600">Routh</span>
            </span>
          </div>
          
          <div>
            <div className="flex items-center gap-2 sm:gap-4">
              {userProfile?.isPremium ? (
                <span className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold bg-gradient-to-r from-amber-200 to-yellow-400 text-amber-900 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-sm">
                  <Crown size={12} className="fill-amber-900/20 sm:w-3.5 sm:h-3.5" /> PREMIUM
                </span>
              ) : (
                <button onClick={() => setShowUpgradeModal(true)} className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 px-3 sm:px-4 py-1.5 rounded-full transition-all shadow-sm hover:shadow-md">
                  <Sparkles size={12} className="sm:w-3.5 sm:h-3.5" /> UPGRADE
                </button>
              )}
              <div className="hidden sm:flex items-center gap-3 text-sm text-slate-600 border-l border-slate-200 pl-4">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full ring-2 ring-white shadow-sm" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                    <UserIcon size={16} />
                  </div>
                )}
                <span className="font-medium">{user.displayName?.split(' ')[0]}</span>
              </div>
              <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1.5 p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <LogOut size={18} /> <span className="hidden sm:inline font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-1 p-1 bg-slate-200/50 rounded-xl w-fit border border-slate-200/50 backdrop-blur-sm"
        >
          <button 
            onClick={() => setActiveTab('create')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'create' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
          >
            Create New
          </button>
          <button 
            onClick={() => setActiveTab('library')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'library' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
          >
            <ListMusic size={16} /> My Library
          </button>
        </motion.div>

        {activeTab === 'create' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            
            {!userProfile?.isPremium && (
              <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100/50 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={16} className="text-indigo-600" />
                    <p className="text-sm font-bold text-indigo-900 uppercase tracking-wider">Free Tier</p>
                  </div>
                  <p className="text-slate-600 font-medium">You have <span className="text-indigo-700 font-bold">{generationsLeft}</span> free generations remaining.</p>
                </div>
                {generationsLeft === 0 && (
                  <button onClick={() => setShowUpgradeModal(true)} className="bg-indigo-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 whitespace-nowrap">
                    Upgrade to Premium
                  </button>
                )}
              </div>
            )}

            <section className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-200/60 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-bold font-display text-slate-900">
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
                  <p className="text-slate-500">Paste news articles, URLs, or just say the topics(e.g., Latest AI news, Stock market updates)....</p>
                </div>
                <button 
                  onClick={loadDemoText}
                  className="flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
                >
                  <Sparkles size={16} />
                  Try Demo Text
                </button>
              </div>

              <div className="space-y-4">
                <AnimatePresence>
                  {articles.map((article, index) => (
                    <motion.div 
                      key={index} 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex gap-3"
                    >
                      <div className="relative flex-1 group">
                        <div className="absolute top-4 left-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                          <FileText size={20} />
                        </div>
                        <textarea
                          value={article}
                          onChange={(e) => handleArticleChange(index, e.target.value)}
                          placeholder="Paste article text, URLs, or just type topics (e.g., 'Latest AI news', 'Stock market updates')..."
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all resize-none min-h-[100px] text-slate-700"
                          rows={3}
                        />
                      </div>
                      {articles.length > 1 && (
                        <button
                          onClick={() => handleRemoveArticle(index)}
                          className="p-4 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all h-fit self-start border border-transparent hover:border-red-100"
                          title="Remove article"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <button
                onClick={handleAddArticle}
                className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 px-4 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors border border-dashed border-indigo-200 w-full justify-center sm:w-auto"
              >
                <Plus size={18} />
                Add another source
              </button>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 space-y-3">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                  <Globe size={16} className="text-indigo-500" /> Language
                </label>
                <select 
                  value={language} 
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white font-medium text-slate-700 cursor-pointer"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Tamil">Tamil</option>
                  <option value="Telugu">Telugu</option>
                  <option value="Kannada">Kannada</option>
                  <option value="Malayalam">Malayalam</option>
                  <option value="Bengali">Bengali</option>
                  <option value="Marathi">Marathi</option>
                  <option value="Gujarati">Gujarati</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Japanese">Japanese</option>
                </select>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 space-y-3">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                  <Settings size={16} className="text-indigo-500" /> Tone
                </label>
                <select 
                  value={tone} 
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white font-medium text-slate-700 cursor-pointer"
                >
                  <option value="conversational">Conversational & Friendly</option>
                  <option value="newsy">Professional News</option>
                  <option value="comedy">Lighthearted & Funny</option>
                  <option value="analytical">Deep & Analytical</option>
                </select>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 space-y-3">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                  <Clock size={16} className="text-indigo-500" /> Length
                </label>
                <select 
                  value={length} 
                  onChange={(e) => setLength(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white font-medium text-slate-700 cursor-pointer"
                >
                  <option value="2min">2 mins</option>
                  <option value="3min">3 mins</option>
                  <option value="4min">4 mins</option>
                </select>
              </div>
            </section>

            <section className="pt-2">
              <button
                onClick={() => handleGenerate()}
                disabled={isGenerating || isGeneratingAudio || (!userProfile?.isPremium && generationsLeft <= 0)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-5 rounded-2xl shadow-lg shadow-slate-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg group"
              >
                {isGenerating || isGeneratingAudio ? (
                  <>
                    <Loader2 size={24} className="animate-spin text-indigo-400" />
                    <span className="animate-pulse">{progressText}</span>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play size={16} className="fill-current ml-0.5" />
                    </div>
                    Generate Audio Summary
                  </>
                )}
              </button>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-5 bg-red-50 text-red-800 rounded-2xl text-sm border border-red-100 flex flex-col gap-3 shadow-sm"
                >
                  <p className="font-medium">{error}</p>
                  {(error.includes('free trial limit') || error.includes('limit of 3 free generations')) && (
                    <button onClick={handleSubscribe} className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold w-fit hover:bg-red-700 shadow-sm">
                      Subscribe Now
                    </button>
                  )}
                </motion.div>
              )}
            </section>

            <AnimatePresence>
              {(currentAudioSrc || currentScript) && (
                <motion.section 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6 pt-8 border-t border-slate-200/60"
                >
                  {isGeneratingAudio && (
                    <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-200/60 space-y-6 relative overflow-hidden flex items-center justify-center">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500 animate-pulse" />
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 size={32} className="animate-spin text-indigo-500" />
                        <p className="text-slate-600 font-medium animate-pulse">Generating high-quality audio... this may take a few seconds.</p>
                      </div>
                    </div>
                  )}

                  {currentAudioSrc && (
                    <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-200/60 space-y-6 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
                      <h3 className="font-bold font-display text-xl flex items-center gap-3 text-slate-900">
                        <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                          <Radio size={20} />
                        </div>
                        {currentTitle || <span>Your Echo<span className="text-blue-500">Routh</span> is Ready</span>}
                      </h3>
                      <audio
                        ref={audioRef}
                        controls
                        src={currentAudioSrc}
                        className="w-full h-14 rounded-xl"
                        autoPlay
                        onTimeUpdate={(e) => setAudioCurrentTime(e.currentTarget.currentTime)}
                        onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration)}
                      />
                    </div>
                  )}

                  {currentScript && (
                    <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-200/60 space-y-6">
                      <h3 className="font-bold font-display text-xl flex items-center gap-3 text-slate-900">
                        <div className="p-2 bg-slate-50 rounded-xl text-slate-500">
                          <FileText size={20} />
                        </div>
                        Interactive Transcript
                      </h3>
                      <div className="prose prose-slate max-w-none prose-p:leading-relaxed prose-p:text-slate-600 max-h-[500px] overflow-y-auto pr-4 scroll-smooth" id="transcript-container">
                        {(() => {
                          const scriptLines = currentScript.split('\n').filter(line => line.trim() !== '');
                          const totalChars = scriptLines.reduce((acc, line) => acc + line.length, 0);
                          let accumulatedChars = 0;
                          const currentRatio = audioDuration > 0 ? audioCurrentTime / audioDuration : 0;
                          
                          return scriptLines.map((line, i) => {
                            const startRatio = accumulatedChars / totalChars;
                            const endRatio = (accumulatedChars + line.length) / totalChars;
                            accumulatedChars += line.length;
                            
                            const isActive = currentRatio >= startRatio && currentRatio <= endRatio && audioCurrentTime > 0;
                            
                            let speaker = '';
                            let text = line;
                            
                            if (line.startsWith('Aavya:')) {
                              speaker = 'Aavya';
                              text = line.substring(6).trim();
                            } else if (line.startsWith('Ishaan:')) {
                              speaker = 'Ishaan';
                              text = line.substring(7).trim();
                            } else if (line.startsWith('Alex:')) {
                              speaker = 'Alex';
                              text = line.substring(5).trim();
                            } else if (line.startsWith('Sam:')) {
                              speaker = 'Sam';
                              text = line.substring(4).trim();
                            }

                            return (
                              <p 
                                key={i} 
                                className={`mb-4 p-3 rounded-xl transition-all duration-300 ${isActive ? 'bg-indigo-50/80 border-l-4 border-indigo-500 shadow-sm transform scale-[1.02]' : 'opacity-70 hover:opacity-100'}`}
                                ref={(el) => {
                                  if (isActive && el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }
                                }}
                              >
                                {speaker === 'Aavya' || speaker === 'Alex' ? (
                                  <strong className="text-indigo-600 font-bold uppercase tracking-wide text-xs bg-indigo-100/50 px-2 py-1 rounded mr-2">{speaker}</strong>
                                ) : speaker === 'Ishaan' || speaker === 'Sam' ? (
                                  <strong className="text-violet-600 font-bold uppercase tracking-wide text-xs bg-violet-100/50 px-2 py-1 rounded mr-2">{speaker}</strong>
                                ) : null}
                                <span className={isActive ? 'text-slate-900 font-medium' : 'text-slate-600'}>{text}</span>
                              </p>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </motion.section>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {user && activeTab === 'library' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            
            {!userProfile?.isPremium && (
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 sm:p-8 rounded-[2rem] shadow-lg flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full pointer-events-none" />
                <div className="relative z-10">
                  <h3 className="font-bold font-display text-xl flex items-center gap-3 text-white">
                    <div className="p-2 bg-white/20 rounded-xl text-white">
                      <Sparkles size={20} />
                    </div>
                    Unlock Auto-Pay Subscription
                  </h3>
                  <p className="text-indigo-100 mt-2 max-w-md">Get unlimited generations and premium features for just ₹99. Choose between a one-time payment or seamless auto-pay.</p>
                </div>
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <div className="flex bg-white/10 p-1 rounded-xl backdrop-blur-md border border-white/10">
                    <button 
                      onClick={() => setIsRecurring(false)}
                      className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${!isRecurring ? 'bg-white text-indigo-700 shadow-lg' : 'text-white hover:bg-white/5'}`}
                    >
                      1 MONTH
                    </button>
                    <button 
                      onClick={() => setIsRecurring(true)}
                      className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${isRecurring ? 'bg-white text-indigo-700 shadow-lg' : 'text-white hover:bg-white/5'}`}
                    >
                      AUTO-PAY
                    </button>
                  </div>
                  <button 
                    onClick={() => setShowUpgradeModal(true)}
                    className="bg-white text-indigo-700 hover:bg-indigo-50 px-8 py-4 rounded-2xl text-lg font-black shadow-xl shadow-indigo-900/20 transition-all flex items-center gap-2"
                  >
                    Subscribe Now
                  </button>
                </div>
              </div>
            )}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 sm:p-8 rounded-[2rem] shadow-lg flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[80px] rounded-full pointer-events-none" />
              <div className="relative z-10">
                <h3 className="font-bold font-display text-xl flex items-center gap-3 text-white">
                  <div className="p-2 bg-orange-500/20 rounded-xl text-orange-400">
                    <Rss size={20} />
                  </div>
                  Personal Podcast Feed
                </h3>
                <p className="text-slate-400 mt-2 max-w-md">Subscribe to this private RSS feed in Apple Podcasts, Spotify, or your favorite app to automatically sync new generations.</p>
              </div>
              <div className="relative z-10 flex items-center gap-3">
                <button 
                  onClick={copyRssUrl}
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap backdrop-blur-sm border border-white/10"
                >
                  {copiedRss ? <><Check size={18} className="text-emerald-400" /> Copied!</> : 'Copy RSS URL'}
                </button>
                <button
                  onClick={() => setShowRssHelp(true)}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white p-3 rounded-xl transition-all backdrop-blur-sm border border-white/5"
                  title="How to use RSS"
                >
                  <HelpCircle size={20} />
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider font-bold">
              <p><strong>Legal Notice:</strong> EchoRouth generates AI-powered summaries for personal use. We do not claim ownership of the source material. Users are responsible for ensuring their use of summarized content complies with local copyright laws and "Fair Use" doctrines. By using this service, you agree to our <button onClick={() => setActivePolicy('terms')} className="text-blue-600 hover:underline">Terms of Service</button>.</p>
            </div>

            <div>
              <h2 className="text-2xl font-bold font-display mb-6 text-slate-900">
                Your <br />
                <div className="h-[1.2em] relative overflow-hidden inline-block align-bottom min-w-[120px]">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={LIBRARY_WORDS[index]}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      transition={{ duration: 0.5, ease: "circOut" }}
                      className="absolute left-0 right-0 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      {LIBRARY_WORDS[index]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </h2>
              {savedPodcasts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-[2rem] border border-slate-200/60 border-dashed">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ListMusic size={32} className="text-slate-400" />
                  </div>
                  <p className="text-slate-500 text-lg">You haven't generated any podcasts yet.</p>
                  <button 
                    onClick={() => setActiveTab('create')}
                    className="mt-4 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
                  >
                    Create your first Echo<span className="text-blue-500">Routh</span> →
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {savedPodcasts.map((podcast) => (
                    <motion.div 
                      key={podcast.id} 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col sm:flex-row gap-5 justify-between items-start sm:items-center hover:shadow-md transition-all group"
                    >
                      <div className="space-y-2 flex-1">
                        <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">{podcast.title}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                          <span className="uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-md">{podcast.tone}</span>
                          <span className="uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-md">{podcast.length}</span>
                          {podcast.language && <span className="uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-md">{podcast.language}</span>}
                          <span className="flex items-center gap-1"><Clock size={12} /> {podcast.createdAt?.toDate ? podcast.createdAt.toDate().toLocaleDateString() : 'Just now'}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handlePlaySaved(podcast)}
                        className="bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap border border-slate-200 hover:border-indigo-200"
                      >
                        <Play size={16} className="fill-current" /> Play
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* App Footer */}
        <footer className="mt-20 py-10 border-t border-slate-100 text-center space-y-6">
          <div className="flex flex-wrap justify-center gap-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <button onClick={() => setActivePolicy('privacy')} className="hover:text-blue-600 transition-colors">Privacy Policy</button>
            <button onClick={() => setActivePolicy('terms')} className="hover:text-blue-600 transition-colors">Terms of Service</button>
            <button onClick={() => setActivePolicy('refund')} className="hover:text-blue-600 transition-colors">Refund Policy</button>
          </div>
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">
            © 2026 EchoRouth. All rights reserved.
          </p>
        </footer>
      </main>

      <AnimatePresence>
        {showUpgradeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden flex flex-col relative"
            >
              <button 
                onClick={() => setShowUpgradeModal(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="p-8 pt-12 text-center space-y-6">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl mx-auto flex items-center justify-center shadow-xl shadow-indigo-500/20">
                  <Crown size={40} className="text-white fill-white/20" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">Go Premium</h3>
                  <p className="text-slate-500 font-medium">Unlimited generations, higher quality audio, and priority support.</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setIsRecurring(false)}
                      className={`p-4 rounded-2xl border-2 transition-all text-left space-y-1 ${!isRecurring ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-black uppercase tracking-wider ${!isRecurring ? 'text-indigo-600' : 'text-slate-400'}`}>1 Month</span>
                        {!isRecurring && <CheckCircle2 size={16} className="text-indigo-600" />}
                      </div>
                      <div className="text-xl font-black text-slate-900">₹99</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">One-time</div>
                    </button>

                    <button 
                      onClick={() => setIsRecurring(true)}
                      className={`p-4 rounded-2xl border-2 transition-all text-left space-y-1 relative overflow-hidden ${isRecurring ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                    >
                      {isRecurring && <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg uppercase tracking-tighter">Best Value</div>}
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-black uppercase tracking-wider ${isRecurring ? 'text-indigo-600' : 'text-slate-400'}`}>Auto-Pay</span>
                        {isRecurring && <CheckCircle2 size={16} className="text-indigo-600" />}
                      </div>
                      <div className="text-xl font-black text-slate-900">₹99<span className="text-xs font-bold text-slate-400">/mo</span></div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Recurring</div>
                    </button>
                  </div>
                  
                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                    <div className="space-y-3">
                      <div className="relative">
                        <input 
                          type="text"
                          placeholder="Coupon Code"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          className="w-full pl-4 pr-12 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-700 uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500">
                          <Zap size={18} />
                        </div>
                      </div>
                      {couponCode && (
                        <p className="text-xs font-bold text-indigo-600 flex items-center gap-1 justify-center italic">
                          Coupon will be applied at checkout
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleSubscribe}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-slate-900/20 transition-all flex items-center justify-center gap-3 group"
                >
                  Pay & Subscribe
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Secure payment via Razorpay</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RSS Help Modal */}
      <AnimatePresence>
        {showRssHelp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Rss className="text-orange-500" /> How to Sync Your Podcast
                </h3>
                <button onClick={() => setShowRssHelp(false)} className="text-slate-400 hover:text-slate-600 bg-white shadow-sm p-2 rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <div className="aspect-video bg-slate-900 rounded-2xl mb-6 overflow-hidden relative shadow-inner">
                  <video 
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                    className="w-full h-full object-cover opacity-80"
                    src="https://assets.mixkit.co/videos/preview/mixkit-man-listening-to-music-with-headphones-2869-large.mp4"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-slate-900/80 to-transparent">
                    <div className="text-center mt-20">
                      <p className="text-white font-medium text-lg">Listen anywhere, anytime.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0">1</div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg">Copy your unique RSS link</h4>
                      <p className="text-slate-600 mt-1">Click the "Copy RSS URL" button in your library. This link is private and unique to your account.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0">2</div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg">Open your favorite Podcast App</h4>
                      <p className="text-slate-600 mt-1">Open Apple Podcasts, Spotify, Pocket Casts, or Overcast on your phone.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0">3</div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg">Add a show by URL</h4>
                      <p className="text-slate-600 mt-1">Look for the option to <strong>"Follow a Show by URL"</strong> or <strong>"Add RSS Feed"</strong> in your app's library settings, and paste your link.</p>
                      <div className="mt-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600">
                        <strong>Apple Podcasts:</strong> Library &gt; "..." menu &gt; Follow a Show by URL<br/>
                        <strong>Pocket Casts:</strong> Discover &gt; Search bar &gt; Paste URL &gt; Search
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button 
                  onClick={() => setShowRssHelp(false)}
                  className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Got it!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activePolicy === 'privacy' && <PrivacyPolicy onClose={() => setActivePolicy(null)} />}
        {activePolicy === 'terms' && <TermsOfService onClose={() => setActivePolicy(null)} />}
        {activePolicy === 'refund' && <RefundPolicy onClose={() => setActivePolicy(null)} />}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}
