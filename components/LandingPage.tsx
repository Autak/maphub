import React, { useState } from 'react';
import { User } from '../types';
import { ArrowRight, Globe, Mail, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

interface LandingPageProps {
  onLogin: (user: User, token?: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      if (isRegistering) {
        if (!formData.username || !formData.email || !formData.password) {
          setError('All fields are required');
          setIsSubmitting(false);
          return;
        }
        if (formData.username.length < 2) {
          setError('Username must be at least 2 characters');
          setIsSubmitting(false);
          return;
        }
        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters');
          setIsSubmitting(false);
          return;
        }

        const result = await api.register({
          username: formData.username,
          email: formData.email,
          password: formData.password,
        });

        if (result.autoVerified) {
          setSuccessMessage('Account created! You can now log in.');
          setIsRegistering(false);
          setFormData({ ...formData, username: '' });
        } else {
          setSuccessMessage('Account created! Check your email for a verification link.');
        }

      } else {
        if (!formData.email || !formData.password) {
          setError('Email and password are required');
          setIsSubmitting(false);
          return;
        }

        const result = await api.login({
          email: formData.email,
          password: formData.password,
        });

        const user: User = {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          password: '',
          color: result.user.color,
          bio: result.user.bio,
          avatarUrl: result.user.avatarUrl,
          joinedAt: result.user.joinedAt,
          bookmarks: result.user.bookmarks || [],
        };

        onLogin(user, result.token);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-sans text-white">
      {/* Background Cinematic Video/Image */}
      <motion.div
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.6 }}
        transition={{ duration: 3, ease: 'easeOut' }}
        className="absolute inset-0 z-0"
      >
        <img
          src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2000"
          alt="Cinematic Mountains"
          className="w-full h-full object-cover"
        />
        {/* Vignette & Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />
      </motion.div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full h-full flex items-center justify-start px-8 md:px-24">

        <div className="max-w-md w-full">
          {/* Logo & Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20 shadow-2xl">
                <Globe size={24} strokeWidth={1.5} />
              </div>
              <span className="text-xl font-bold tracking-widest uppercase text-white/90">TrailThread</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-[1.1] tracking-tight">
              Share your world.<br />
              <span className="text-white/50 italic font-light">One pin at a time.</span>
            </h1>

            <p className="text-lg text-white/70 font-light leading-relaxed max-w-sm">
              The premium social journal for modern explorers. Map your memories with pixel-perfect precision.
            </p>
          </motion.div>

          {/* Glassmorphism Auth Form */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl"
          >
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {isRegistering ? 'Join the journey' : 'Welcome back'}
                </h2>
              </div>

              <AnimatePresence mode="popLayout">
                {isRegistering && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.3 }}
                    className="relative overflow-hidden"
                  >
                    <div className="absolute left-4 top-4 text-white/40"><UserIcon size={20} className="mt-0.5" strokeWidth={1.5} /></div>
                    <input
                      name="username" type="text" placeholder="Username"
                      value={formData.username} onChange={handleInputChange}
                      className="w-full pl-12 pr-4 py-4 bg-white/5 text-white placeholder-white/40 rounded-xl border border-white/10 focus:border-white/40 focus:bg-white/10 focus:outline-none transition-all"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative mt-4">
                <div className="absolute left-4 top-4 text-white/40"><Mail size={20} className="mt-0.5" strokeWidth={1.5} /></div>
                <input
                  name="email" type="text"
                  placeholder={isRegistering ? "Email Address" : "Email or Username"}
                  value={formData.email} onChange={handleInputChange}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 text-white placeholder-white/40 rounded-xl border border-white/10 focus:border-white/40 focus:bg-white/10 focus:outline-none transition-all"
                />
              </div>

              <div className="relative">
                <div className="absolute left-4 top-4 text-white/40"><Lock size={20} className="mt-0.5" strokeWidth={1.5} /></div>
                <input
                  name="password" type="password" placeholder="Password"
                  value={formData.password} onChange={handleInputChange}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 text-white placeholder-white/40 rounded-xl border border-white/10 focus:border-white/40 focus:bg-white/10 focus:outline-none transition-all"
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-400 text-sm font-medium pt-2"
                  >
                    {error}
                  </motion.p>
                )}
                {successMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-emerald-400 text-sm font-medium pt-2"
                  >
                    {successMessage}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-white text-black font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] disabled:opacity-50 mt-6"
              >
                {isSubmitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>{isRegistering ? 'Start Exploring' : 'Enter'} <ArrowRight size={20} strokeWidth={1.5} /></>
                )}
              </motion.button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccessMessage(''); setFormData({ username: '', email: '', password: '' }); }}
                className="text-sm text-white/50 hover:text-white transition-colors"
              >
                {isRegistering ? 'Already have an account? Log in' : 'New to TrailThread? Request Access'}
              </button>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
};

export default LandingPage;
