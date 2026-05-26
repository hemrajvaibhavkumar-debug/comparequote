import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Builder from './Builder';
import SavedTables from './SavedTables';
import ViewTable from './ViewTable';
import Login from './Login';
import POMaker from './components/POMaker/POMaker';
import POSettings from './components/Settings/POSettings';
import SavedPOs from './SavedPOs';
import PurchaseHeadDashboard from './PurchaseHeadDashboard';
import POApprovalView from './POApprovalView';
import { Settings as SettingsIcon, FileText, Database, ShieldCheck } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';

const ProtectedRoute = ({ children, permission }: { children: React.ReactNode, permission?: string }) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  if (permission) {
    const userRole = user?.role || 'SUPERADMIN';
    const userPermissions = user?.permissions || [];
    
    if (userRole === 'SUPERADMIN') return <>{children}</>;

    // Special case for Approval Hub: allow either full approve or read-only view
    if (permission === 'VIEW_APPROVAL_HUB') {
       if (userPermissions.includes('VIEW_APPROVAL_HUB') || userPermissions.includes('APPROVE_PO')) {
         return <>{children}</>;
       }
    }
    
    if (!userPermissions.includes(permission)) {
      return <Navigate to="/" replace />;
    }
  }
  
  return <>{children}</>;
};

function AppContent() {
  const { isAuthenticated, logout, user } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/saved/');
    }
    return location.pathname.startsWith(path);
  };

  const navLinkStyle = (path: string, colorClass = 'indigo') => {
    const active = isActive(path);
    return `px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 border border-transparent ${
      active
        ? `bg-indigo-50 text-indigo-600 border-indigo-100/50 shadow-xs`
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    }`;
  };

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans text-slate-900 antialiased transition-colors duration-300">
      {isAuthenticated && (
        <nav className="glass-navbar sticky top-0 z-50 transition-standard">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center gap-6">
                <Link to="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-slate-900 hover:opacity-90 transition-opacity">
                  <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2.5"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
                  </span>
                  <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent font-black tracking-tight">QuoteCompare</span>
                </Link>
                
                <div className="hidden sm:flex space-x-1.5 ml-4 items-center">
                  <Link to="/" className={navLinkStyle('/', 'indigo')}>Compare</Link>
                  <Link to="/saved" className={isActive('/saved') && !isActive('/saved-pos') ? 'px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 border bg-indigo-50 text-indigo-600 border-indigo-100/50 shadow-xs' : 'px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'}>Saved Tables</Link>
                  
                  <div className="h-5 w-px bg-slate-200 mx-2"></div>
                  
                  <Link to="/po-maker" className={navLinkStyle('/po-maker', 'indigo')}>
                    <FileText className="w-4 h-4" /> PO Maker
                  </Link>
                  <Link to="/saved-pos" className={navLinkStyle('/saved-pos', 'indigo')}>
                    <Database className="w-4 h-4" /> Saved POs
                  </Link>
                  
                  {(user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_PO') || user?.permissions.includes('VIEW_APPROVAL_HUB')) && (
                    <Link to="/purchase-head" className={navLinkStyle('/purchase-head', 'blue')}>
                      <ShieldCheck className="w-4 h-4" /> Approval Hub
                    </Link>
                  )}
                  
                  <Link to="/settings" className={navLinkStyle('/settings', 'indigo')}>
                    <SettingsIcon className="w-4 h-4" /> Settings
                  </Link>
                </div>
              </div>
              <div className="flex items-center">
                 <button 
                   onClick={logout}
                   className="px-4 py-1.5 rounded-xl text-[10px] font-black text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-100 transition-all duration-200 uppercase tracking-wider cursor-pointer shadow-xs hover:shadow-sm"
                 >
                   Logout
                 </button>
              </div>
            </div>
          </div>
        </nav>
      )}

      <main className="relative z-10">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Builder /></ProtectedRoute>} />
          <Route path="/saved" element={<ProtectedRoute><SavedTables /></ProtectedRoute>} />
          <Route path="/saved/:id" element={<ProtectedRoute><ViewTable /></ProtectedRoute>} />
          <Route path="/po-maker" element={<ProtectedRoute><POMaker /></ProtectedRoute>} />
          <Route path="/saved-pos" element={<ProtectedRoute><SavedPOs /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><POSettings /></ProtectedRoute>} />
          <Route path="/purchase-head" element={<ProtectedRoute permission="VIEW_APPROVAL_HUB"><PurchaseHeadDashboard /></ProtectedRoute>} />
          <Route path="/approve-po/:id" element={<ProtectedRoute permission="VIEW_APPROVAL_HUB"><POApprovalView /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
