import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Sparkles, Zap, Shield, PlayCircle, Square, ArrowRight, Mail, MapPin, Phone, CheckCircle2, Star, Users, Clock, Globe } from 'lucide-react';
import PrivacyPolicy from './PrivacyPolicy';
import TermsOfService from './TermsOfService';
import RefundPolicy from './RefundPolicy';

interface LandingPageProps {
  onLogin: () => void;
}

const ROTATING_WORDS = ["Articles", "News", "Notes", "URLs"];

export default function LandingPage({ onLogin }: LandingPageProps) {
  const [index, setIndex] = useState(0);
  const [activePolicy, setActivePolicy] = useState<'privacy' | 'terms' | 'refund' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const playDemo = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }
    
    setIsPlaying(true);
    const text1 = new SpeechSynthesisUtterance("Welcome to EchoRouth! Today we're diving into the latest breakthroughs in AI and quantum computing.");
    const voices = window.speechSynthesis.getVoices();
    text1.voice = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google UK English Female')) || voices[0];
    text1.pitch = 1.2;
    text1.rate = 1.05;
    
    const text2 = new SpeechSynthesisUtterance("That's right, Aavya. The new research paper suggests we might see practical applications much sooner than expected.");
    text2.voice = voices.find(v => v.name.includes('Male') || v.name.includes('Alex') || v.name.includes('Google UK English Male')) || voices[0];
    text2.pitch = 0.9;
    text2.rate = 1.05;

    text1.onend = () => {
      window.speechSynthesis.speak(text2);
    };
    
    text2.onend = () => {
      setIsPlaying(false);
    };

    text1.onerror = () => setIsPlaying(false);
    text2.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(text1);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        duration: 0.6, 
        ease: [0.22, 1, 0.36, 1] as any 
      } 
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 overflow-x-hidden font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Navbar */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 group cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20 group-hover:scale-110 transition-transform">
              <Radio size={26} className="text-white" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-slate-900 font-display">
              Echo<span className="text-blue-600">Routh</span>
            </span>
          </motion.div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-blue-600 transition-colors">How it Works</a>
            <a href="#contact" className="hover:text-blue-600 transition-colors">Support</a>
          </div>

          <motion.button 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLogin}
            className="text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 px-6 py-2.5 rounded-full transition-all shadow-md"
          >
            Sign In
          </motion.button>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative pt-20 pb-32 overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-24 -left-24 w-96 h-96 bg-blue-400/20 blur-[100px] rounded-full"
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.3, 1],
              rotate: [0, -90, 0],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/2 -right-24 w-[500px] h-[500px] bg-indigo-400/20 blur-[120px] rounded-full"
          />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-8"
            >
              <motion.div 
                variants={itemVariants}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold uppercase tracking-widest"
              >
                <Sparkles size={14} />
                <span>AI-Powered Audio Summaries</span>
              </motion.div>
              
              <motion.h1 
                variants={itemVariants}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight text-slate-900 font-display"
              >
                Turn your <br className="hidden sm:block" />
                <div className="h-[1.1em] relative overflow-hidden inline-block align-bottom min-w-[150px] sm:min-w-[200px]">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={ROTATING_WORDS[index]}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      transition={{ duration: 0.5, ease: "circOut" }}
                      className="absolute left-0 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 font-display text-4xl sm:text-5xl lg:text-6xl font-bold"
                    >
                      {ROTATING_WORDS[index]}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <br />
                into a podcast.
              </motion.h1>
              
              <motion.p 
                variants={itemVariants}
                className="text-xl text-slate-600 max-w-xl leading-relaxed font-medium"
              >
                Paste articles, news, or notes. Our AI instantly generates a conversational, two-host podcast script and synthesizes it into lifelike audio for your commute.
              </motion.p>
              
              <motion.div 
                variants={itemVariants}
                className="flex flex-col sm:flex-row gap-6 pt-4 items-start sm:items-center"
              >
                <motion.button 
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onLogin}
                  className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700 px-8 sm:px-10 py-4 sm:py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-500/25 text-lg sm:text-xl group"
                >
                  Get Started Free
                  <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                </motion.button>
                
                <div className="flex items-center gap-4 px-2 sm:px-4">
                  <div className="flex -space-x-3">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200 overflow-hidden">
                        <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                  <div className="text-sm font-semibold text-slate-500">
                    <span className="text-slate-900">1,000+</span> users joined
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Visual/Mockup */}
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-indigo-500/20 blur-[100px] rounded-full" />
              <motion.div 
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="relative bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl overflow-hidden"
              >
                <div className="flex items-center gap-2 mb-6 sm:mb-8 border-b border-slate-100 pb-4 sm:pb-6">
                  <div className="w-3 h-3 rounded-full bg-rose-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <div className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">EchoRouth Studio</div>
                </div>
                
                <div className="space-y-4 sm:space-y-6">
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 }}
                    className="flex gap-3 sm:gap-4 items-start"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                      <span className="text-white text-xs font-black">A</span>
                    </div>
                    <div className="bg-slate-50 rounded-2xl sm:rounded-3xl rounded-tl-none p-4 sm:p-5 text-sm font-medium text-slate-800 border border-slate-100 shadow-sm">
                      Welcome to EchoRouth! Today we're diving into the latest breakthroughs in AI and quantum computing.
                    </div>
                  </motion.div>
                  
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.5 }}
                    className="flex gap-3 sm:gap-4 items-start flex-row-reverse"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                      <span className="text-white text-xs font-black">I</span>
                    </div>
                    <div className="bg-blue-600 rounded-2xl sm:rounded-3xl rounded-tr-none p-4 sm:p-5 text-sm font-medium text-white shadow-lg shadow-blue-500/20">
                      That's right, Aavya. The new research paper suggests we might see practical applications much sooner than expected.
                    </div>
                  </motion.div>
                </div>

                {/* Fake Audio Player */}
                <div className="mt-8 sm:mt-10 bg-slate-900 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 flex items-center gap-4 sm:gap-6 shadow-2xl">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={playDemo}
                    className="w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/40"
                  >
                    {isPlaying ? <Square size={24} className="fill-current" /> : <PlayCircle size={28} className="ml-1" />}
                  </motion.button>
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Now Playing</p>
                        <p className="text-sm font-bold text-white">AI Breakthroughs 2026</p>
                      </div>
                      <div className="flex gap-1 items-end h-4">
                        {[0.4, 0.7, 0.3, 0.9, 0.5, 0.8].map((h, i) => (
                          <motion.div 
                            key={i}
                            animate={isPlaying ? { height: ["20%", "100%", "20%"] } : { height: `${h * 100}%` }}
                            transition={{ duration: 0.5 + i * 0.1, repeat: Infinity }}
                            className="w-1 bg-blue-500 rounded-full"
                            style={{ height: `${h * 100}%` }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "45%" }}
                        transition={{ duration: 2, delay: 1 }}
                        className="h-full bg-blue-500 rounded-full" 
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Stats Section */}
      <section className="py-20 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { label: "Podcasts Created", value: "50K+", icon: Radio },
              { label: "Active Listeners", value: "12K+", icon: Users },
              { label: "Time Saved", value: "100Kh", icon: Clock },
              { label: "User Rating", value: "4.9/5", icon: Star },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center space-y-2"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mb-2">
                  <stat.icon size={24} />
                </div>
                <p className="text-4xl font-black tracking-tight text-slate-900">{stat.value}</p>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 font-display">How it Works</h2>
            <p className="text-xl text-slate-600 font-medium">Three simple steps to turn your reading into listening.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Input Content",
                desc: "Paste text, articles, or URLs. Our system extracts transcripts and core information automatically.",
                color: "bg-blue-600",
                icon: Globe
              },
              {
                step: "02",
                title: "AI Scripting",
                desc: "Gemini AI transforms your content into a conversational script between two engaging hosts.",
                color: "bg-indigo-600",
                icon: Sparkles
              },
              {
                step: "03",
                title: "Audio Magic",
                desc: "High-quality text-to-speech converts the script into a studio-quality podcast.",
                color: "bg-cyan-600",
                icon: PlayCircle
              }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="group relative p-10 rounded-[2.5rem] bg-white border border-slate-100 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2"
              >
                <div className={`w-16 h-16 ${item.color} text-white rounded-2xl flex items-center justify-center font-black text-2xl mb-8 shadow-lg group-hover:rotate-6 transition-transform`}>
                  <item.icon size={28} />
                </div>
                <div className="absolute top-10 right-10 text-slate-100 font-black text-6xl select-none group-hover:text-slate-200 transition-colors">
                  {item.step}
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-4 relative z-10">{item.title}</h3>
                <p className="text-slate-600 font-medium leading-relaxed relative z-10">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="bg-slate-900 py-32 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:40px_40px]" />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-white font-display">Why EchoRouth?</h2>
            <p className="text-xl text-slate-400 font-medium">Cutting-edge technology for the modern commuter.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: "Instant Generation",
                desc: "Paste any text or URL. Our AI processes it in seconds, creating a structured, engaging dialogue.",
                color: "text-blue-400",
                bg: "bg-blue-500/10"
              },
              {
                icon: Radio,
                title: "Lifelike Voices",
                desc: "Powered by Google's latest TTS models, our dual-host format sounds natural and conversational.",
                color: "text-emerald-400",
                bg: "bg-emerald-500/10"
              },
              {
                icon: Shield,
                title: "Secure & Private",
                desc: "Your data is processed securely. Premium users get unlimited access and priority support.",
                color: "text-rose-400",
                bg: "bg-rose-500/10"
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-10 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-sm space-y-6 hover:bg-white/10 transition-all group"
              >
                <div className={`w-16 h-16 rounded-2xl ${feature.bg} flex items-center justify-center ${feature.color} group-hover:scale-110 transition-transform`}>
                  <feature.icon size={32} />
                </div>
                <h3 className="text-2xl font-black text-white">{feature.title}</h3>
                <p className="text-slate-400 font-medium leading-relaxed">
                  {feature.desc}
                </p>
                <div className="pt-4">
                  <div className="flex items-center gap-2 text-blue-400 font-bold text-sm uppercase tracking-widest">
                    <CheckCircle2 size={16} />
                    <span>Included in Pro</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section id="contact" className="bg-white py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-slate-50 rounded-[3rem] p-12 md:p-20 border border-slate-100 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 blur-[100px] rounded-full -mr-48 -mt-48" />
            
            <div className="grid md:grid-cols-2 gap-20 items-center relative z-10">
              <div className="space-y-8">
                <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 font-display">Get in Touch</h2>
                <p className="text-xl text-slate-600 font-medium leading-relaxed">
                  Have questions about your subscription or need technical support? Our team is here to help you get the most out of EchoRouth.
                </p>
                
                <div className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center text-blue-600">
                      <Mail size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Email Support</p>
                      <p className="text-xl font-bold text-slate-900">hemanthkumar.s3125@gmail.com</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center text-blue-600">
                      <MapPin size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Office Location</p>
                      <p className="text-xl font-bold text-slate-900">Bangalore, Karnataka, India</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-100"
              >
                <h3 className="text-2xl font-black text-slate-900 mb-4">Quick Support</h3>
                <p className="text-slate-600 font-medium mb-8">For the fastest response, please include your account email address in your message.</p>
                <a 
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=hemanthkumar.s3125@gmail.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full bg-blue-600 text-white px-8 py-5 rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                >
                  Send us an Email
                </a>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20 group-hover:scale-110 transition-transform">
                <Radio size={26} className="text-white" />
              </div>
              <span className="text-2xl font-black tracking-tighter text-slate-900 font-display">
                Echo<span className="text-blue-600">Routh</span>
              </span>
            </div>
            
            <div className="flex flex-wrap justify-center gap-10 text-sm font-bold text-slate-400 uppercase tracking-widest">
              <button onClick={() => setActivePolicy('privacy')} className="hover:text-blue-600 transition-colors">Privacy Policy</button>
              <button onClick={() => setActivePolicy('terms')} className="hover:text-blue-600 transition-colors">Terms of Service</button>
              <button onClick={() => setActivePolicy('refund')} className="hover:text-blue-600 transition-colors">Refund Policy</button>
            </div>
            
            <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              © 2026 EchoRouth. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {activePolicy === 'privacy' && <PrivacyPolicy onClose={() => setActivePolicy(null)} />}
        {activePolicy === 'terms' && <TermsOfService onClose={() => setActivePolicy(null)} />}
        {activePolicy === 'refund' && <RefundPolicy onClose={() => setActivePolicy(null)} />}
      </AnimatePresence>
    </div>
  );
}
