'use client';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Layers } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, username, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      
      <div className="absolute top-10 left-10 flex items-center gap-3 z-20">
        <div className="w-10 h-10 rounded-[12px] bg-[var(--primary-gradient)] flex items-center justify-center shadow-[var(--shadow-primary)]">
          <Layers className="w-5 h-5 text-white" strokeWidth={2} />
        </div>
        <span className="font-bold text-[22px] text-[var(--text)] tracking-tight">Drawspace</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-[440px] bg-[var(--card)] border border-[var(--border)] rounded-[24px] p-10 shadow-[var(--shadow-sidebar)] relative z-10"
      >
        <div className="text-center mb-10">
          <h2 className="text-[28px] font-bold text-[var(--text)] mb-3 tracking-tight">Create your account</h2>
          <p className="text-[15px] text-[var(--muted)]">Start collaborating in seconds</p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-[12px] text-[14px] text-[var(--danger)] text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[14px] font-semibold text-[var(--text)] mb-2 ml-1">Username</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="w-5 h-5 text-[var(--muted)] group-focus-within:text-[var(--primary)] transition-colors" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. johndoe"
                required
                minLength={3}
                className="input w-full pl-12 pr-4 py-3.5 text-[15px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[14px] font-semibold text-[var(--text)] mb-2 ml-1">Email address</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-[var(--muted)] group-focus-within:text-[var(--primary)] transition-colors" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="input w-full pl-12 pr-4 py-3.5 text-[15px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[14px] font-semibold text-[var(--text)] mb-2 ml-1">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-[var(--muted)] group-focus-within:text-[var(--primary)] transition-colors" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="input w-full pl-12 pr-4 py-3.5 text-[15px]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-4 flex items-center justify-center text-[16px] mt-4"
          >
            {loading ? (
              <div className="w-6 h-6 border-[2px] border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="mt-10 text-center">
          <p className="text-[15px] text-[var(--muted-darker)]">
            Already have an account?{' '}
            <Link href="/login" className="text-[var(--text)] font-semibold hover:text-[var(--primary)] transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
