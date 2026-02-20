import React, { useState } from 'react';
import { User } from '../types';
import { ArrowRight, Globe, ShieldCheck, Mail, Lock, User as UserIcon, CheckCircle2, Loader2 } from 'lucide-react';
import { api, setToken } from '../services/api';

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
        // --- REGISTER ---
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
          // Dev mode — auto-verified, switch to login
          setSuccessMessage('Account created! You can now log in.');
          setIsRegistering(false);
          setFormData({ ...formData, username: '' });
        } else {
          setSuccessMessage('Account created! Check your email for a verification link.');
        }

      } else {
        // --- LOGIN ---
        if (!formData.email || !formData.password) {
          setError('Email and password are required');
          setIsSubmitting(false);
          return;
        }

        const result = await api.login({
          email: formData.email,
          password: formData.password,
        });

        // Build User object from response
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
    <div className="relative w-full h-full flex overflow-hidden bg-slate-50">

      {/* Left Side - Auth & Value Prop */}
      <div className="w-full md:w-1/2 lg:w-5/12 z-20 bg-white flex flex-col justify-center p-8 md:p-12 shadow-2xl relative">
        <div className="max-w-md mx-auto w-full">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white shadow-lg">
              <Globe size={24} />
            </div>
            <span className="text-2xl font-black text-slate-900 tracking-tighter">TrailThread</span>
          </div>

          <h1 className="text-4xl font-extrabold text-slate-900 mb-6 leading-tight tracking-tight">
            Share your world. <br />
            <span className="text-blue-600">One pin at a time.</span>
          </h1>

          <p className="text-slate-600 mb-8 leading-relaxed font-medium">
            The social journal for travelers. Plan trips, map memories, and explore a feed of adventures from around the globe.
          </p>

          {/* Auth Card */}
          <div className="bg-white p-1 rounded-2xl border border-slate-100 shadow-xl overflow-hidden">
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold text-slate-800">
                  {isRegistering ? 'Create Account' : 'Welcome Back'}
                </h2>
              </div>

              {isRegistering && (
                <div className="relative">
                  <div className="absolute left-3 top-3.5 text-slate-400"><UserIcon size={18} /></div>
                  <input
                    name="username" type="text" placeholder="Username"
                    value={formData.username} onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 text-slate-900 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                  />
                </div>
              )}

              <div className="relative">
                <div className="absolute left-3 top-3.5 text-slate-400"><Mail size={18} /></div>
                <input
                  name="email" type="text"
                  placeholder={isRegistering ? "Email Address" : "Email or Username"}
                  value={formData.email} onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 text-slate-900 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                />
              </div>

              <div className="relative">
                <div className="absolute left-3 top-3.5 text-slate-400"><Lock size={18} /></div>
                <input
                  name="password" type="password" placeholder="Password"
                  value={formData.password} onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 text-slate-900 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                />
              </div>

              {error && <p className="text-red-500 text-xs font-bold bg-red-50 p-2 rounded">{error}</p>}

              {successMessage && (
                <div className="text-emerald-600 text-xs font-bold bg-emerald-50 p-3 rounded flex items-start gap-2">
                  <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>{isRegistering ? 'Sign Up' : 'Log In'} <ArrowRight size={18} /></>
                )}
              </button>
            </form>

            <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
              <button
                onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccessMessage(''); setFormData({ username: '', email: '', password: '' }); }}
                className="text-sm text-slate-600 hover:text-blue-600 font-semibold"
              >
                {isRegistering ? 'Already have an account? Log in' : 'New to TrailThread? Join us'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Visuals */}
      <div className="hidden md:block absolute top-0 right-0 w-7/12 h-full bg-gradient-to-br from-slate-100 to-blue-50">
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white"></div>

        <div className="absolute top-1/2 left-1/4 transform -translate-y-1/2 space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-2xl w-80 transform -rotate-2 border border-slate-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xs">A</div>
              <div>
                <div className="font-bold text-slate-800 text-sm">Alex Explorer</div>
                <div className="text-xs text-slate-500">Just now</div>
              </div>
            </div>
            <div className="h-40 bg-slate-200 rounded-lg mb-3 overflow-hidden">
              <img src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=400" className="w-full h-full object-cover" alt="Mountain Sunset" />
            </div>
            <div>
              <p className="text-slate-700 text-sm font-medium italic">"The best trip of my life."</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-2xl w-72 transform translate-x-12 rotate-3 border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <div className="font-bold text-slate-800">My Profile</div>
              <ShieldCheck size={16} className="text-green-500" />
            </div>
            <div className="flex gap-4 mb-2">
              <div className="flex-1 bg-blue-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-blue-600">12</div>
                <div className="text-[10px] text-blue-400 uppercase">Trips</div>
              </div>
              <div className="flex-1 bg-purple-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-purple-600">48</div>
                <div className="text-[10px] text-purple-400 uppercase">Pins</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;