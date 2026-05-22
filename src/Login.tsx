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
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-black">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-black">Login</h1>
          <p className="text-black/60 text-sm">QuoteCompare AI Dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-black rounded-xl focus:outline-none focus:ring-1 focus:ring-black transition-all text-black"
                placeholder="admin"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-black rounded-xl focus:outline-none focus:ring-1 focus:ring-black transition-all text-black"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && <p className="text-black text-xs font-bold text-center bg-black/5 py-2 rounded">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black/90 transition-all flex items-center justify-center gap-2 shadow-xl"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enter Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
