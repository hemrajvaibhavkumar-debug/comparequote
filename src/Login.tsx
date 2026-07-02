import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, User } from 'lucide-react';
import { useAuth } from './context/AuthContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok) {
        login(data.token, { 
          id: data.id, 
          username: username || 'admin', 
          role: data.role, 
          permissions: data.permissions 
        });
        navigate('/');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/50 dark:bg-slate-950 p-4 relative overflow-hidden transition-colors duration-300">
      {/* Background Ambient Glow Blobs */}
      <div className="ambient-glow bg-slate-200/50 dark:bg-slate-800/20 -top-20 -left-20"></div>
      <div className="ambient-glow bg-slate-200/50 dark:bg-slate-800/20 -bottom-20 -right-20"></div>

      <div className="glass-card max-w-md w-full p-8 sm:p-10 rounded-3xl shadow-2xl relative z-10 transition-all duration-300 hover:shadow-slate-100/30 dark:hover:shadow-none hover:border-slate-300/80 dark:hover:border-slate-700/80">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-slate-900 dark:bg-slate-100 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200 dark:shadow-none mb-4 animate-float">
            <Lock className="w-8 h-8 text-white dark:text-slate-900" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">Welcome Back</h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1 leading-none">QuoteCompare AI Dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Username</label>
            <div className="relative group">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-slate-100 transition-colors" />
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50/40 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10 focus:border-slate-900 dark:focus:border-slate-100 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 font-medium text-sm"
                placeholder="admin"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Password</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-slate-100 transition-colors" />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50/40 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10 focus:border-slate-900 dark:focus:border-slate-100 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 font-medium text-sm"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-rose-600 dark:text-rose-450 text-xs font-bold text-center bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 py-2.5 rounded-xl">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black dark:hover:bg-white active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-slate-100 dark:shadow-none hover:shadow-slate-200 cursor-pointer"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enter Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
