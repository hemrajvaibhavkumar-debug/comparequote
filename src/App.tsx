import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import Builder from './Builder';
import SavedTables from './SavedTables';
import ViewTable from './ViewTable';
import Login from './Login';

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
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center gap-6">
                <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-slate-800 hover:opacity-80">
                  <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
                  </span>
                  QuoteCompare
                </Link>
                <div className="hidden sm:flex space-x-1 ml-4">
                  <Link to="/" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-100 transition-colors">Compare</Link>
                  <Link to="/saved" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-100 transition-colors">Saved Tables</Link>
                </div>
              </div>
              <div className="flex items-center">
                 {localStorage.getItem('admin_token') && (
                   <button 
                     onClick={handleLogout}
                     className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
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
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
