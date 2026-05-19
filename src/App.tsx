import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import Builder from './Builder';
import SavedTables from './SavedTables';
import ViewTable from './ViewTable';
import Login from './Login';
import POMaker from './components/POMaker/POMaker';
import POSettings from './components/Settings/POSettings';
import SavedPOs from './SavedPOs';
import { Settings as SettingsIcon, FileText, Database } from 'lucide-react';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('admin_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export default function App() {
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
  };

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-white font-sans text-black">
        <nav className="bg-white border-b border-black sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center gap-6">
                <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-black hover:opacity-80">
                  <span className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
                  </span>
                  QuoteCompare
                </Link>
                <div className="hidden sm:flex space-x-1 ml-4 items-center">
                  <Link to="/" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-black/10 transition-colors">Compare</Link>
                  <Link to="/saved" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-black/10 transition-colors">Saved Tables</Link>
                  <div className="h-4 w-px bg-black mx-2"></div>
                  <Link to="/po-maker" className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-bold text-black hover:bg-black/10 transition-colors underline decoration-2 underline-offset-4">
                    <FileText className="w-4 h-4" /> PO Maker
                  </Link>
                  <Link to="/saved-pos" className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-black hover:bg-black/10 transition-colors">
                    <Database className="w-4 h-4" /> Saved POs
                  </Link>
                  <Link to="/settings" className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-black hover:bg-black/10 transition-colors">
                    <SettingsIcon className="w-4 h-4" /> Settings
                  </Link>
                </div>
              </div>
              <div className="flex items-center">
                 {localStorage.getItem('admin_token') && (
                   <button 
                     onClick={handleLogout}
                     className="text-xs font-bold text-black hover:underline transition-colors uppercase tracking-widest"
                   >
                     Logout
                   </button>
                 )}
              </div>
            </div>
          </div>
        </nav>

        <main>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Builder /></ProtectedRoute>} />
            <Route path="/saved" element={<ProtectedRoute><SavedTables /></ProtectedRoute>} />
            <Route path="/saved/:id" element={<ProtectedRoute><ViewTable /></ProtectedRoute>} />
            <Route path="/po-maker" element={<ProtectedRoute><POMaker /></ProtectedRoute>} />
            <Route path="/saved-pos" element={<ProtectedRoute><SavedPOs /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><POSettings /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
