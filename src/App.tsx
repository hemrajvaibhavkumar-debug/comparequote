import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Settings as SettingsIcon, FileText, Database, ShieldCheck, ClipboardList, Loader2, Menu, X } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ApiCacheProvider } from './context/ApiCacheContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from './Login'; // Non-lazy for critical path

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Lazy load route components with explicit default handling for safety
const Builder = lazy(() => import('./Builder').then(m => ({ default: m.default })));
const SavedTables = lazy(() => import('./SavedTables').then(m => ({ default: m.default })));
const ViewTable = lazy(() => import('./ViewTable').then(m => ({ default: m.default })));
const POMaker = lazy(() => import('./components/POMaker/POMaker').then(m => ({ default: m.default })));
const POSettings = lazy(() => import('./components/Settings/POSettings').then(m => ({ default: m.default })));
const SavedPOs = lazy(() => import('./SavedPOs').then(m => ({ default: m.default })));
const PurchaseHeadDashboard = lazy(() => import('./PurchaseHeadDashboard').then(m => ({ default: m.default })));
const POApprovalView = lazy(() => import('./POApprovalView').then(m => ({ default: m.default })));
const IndentDashboard = lazy(() => import('./components/Indent/IndentDashboard').then(m => ({ default: m.default })));

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
    <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Module...</p>
  </div>
);

const ProtectedRoute = ({ children, permission }: { children: React.ReactNode, permission?: string }) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  if (permission) {
    const userRole = user?.role || 'SUPERADMIN';
    const userPermissions = user?.permissions || [];
    
    if (userRole === 'SUPERADMIN') return <>{children}</>;

    // Special case for Approval Hub: allow either full approve or read-only view
    if (permission === 'VIEW_APPROVAL_HUB') {
       if (userPermissions.includes('VIEW_APPROVAL_HUB') || userPermissions.includes('APPROVE_PO') || userPermissions.includes('VIEW_SAVED_POS')) {
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/saved/');
    }
    return location.pathname.startsWith(path);
  };

  const navLinkStyle = (path: string, colorClass = 'slate', customActive?: boolean) => {
    const active = customActive !== undefined ? customActive : isActive(path);
    return `px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 border ${
      active
        ? `bg-slate-100/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 shadow-sm`
        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent'
    }`;
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 antialiased transition-colors duration-300">
      {isAuthenticated && (
        <nav className="glass-navbar sticky top-0 z-50 transition-standard">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center gap-6">
                <Link to="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-slate-900 dark:text-slate-100 hover:opacity-90 transition-opacity">
                  <span className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 shadow-md shadow-slate-200 dark:shadow-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2.5"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
                  </span>
                  <span className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent font-black tracking-tight">QuoteCompare</span>
                </Link>
                
                <div className="hidden sm:flex space-x-1.5 ml-4 items-center">
                  {(user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_PO') || user?.permissions.includes('VIEW_APPROVAL_HUB')) && (
                    <Link to="/purchase-head" className={navLinkStyle('/purchase-head')}>
                      <ShieldCheck className="w-4 h-4" /> Approval Hub
                    </Link>
                  )}

                  <Link to="/" className={navLinkStyle('/')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-0.5"><rect width="18" height="18" x="3" y="3" rx="2.5"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M12 3v18"/></svg> Compare
                  </Link>
                  <Link to="/saved" className={navLinkStyle('/saved', 'slate', isActive('/saved') && !isActive('/saved-pos'))}>
                    <Database className="w-4 h-4" /> Saved Tables
                  </Link>
                  
                  <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
                  
                  <Link to="/po-maker" className={navLinkStyle('/po-maker')}>
                    <FileText className="w-4 h-4" /> PO Maker
                  </Link>
                  <Link to="/saved-pos" className={navLinkStyle('/saved-pos')}>
                    <Database className="w-4 h-4" /> Saved POs
                  </Link>
                  <Link to="/indents" className={navLinkStyle('/indents')}>
                    <ClipboardList className="w-4 h-4" /> Indents
                  </Link>
                  
                  <Link to="/settings" className={navLinkStyle('/settings')}>
                    <SettingsIcon className="w-4 h-4" /> Settings
                  </Link>
                </div>
              </div>
              
              {/* Desktop Menu Buttons */}
              <div className="hidden sm:flex items-center gap-3">
                 <button 
                   onClick={logout}
                   className="px-4 py-1.5 rounded-xl text-[10px] font-black text-slate-600 dark:text-slate-400 hover:text-white hover:bg-slate-900 dark:hover:bg-slate-100 dark:hover:text-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-900 dark:hover:border-slate-100 transition-all duration-200 uppercase tracking-wider cursor-pointer shadow-xs hover:shadow-sm"
                 >
                   Logout
                 </button>
              </div>

              {/* Mobile Hamburger Button */}
              <div className="flex sm:hidden items-center gap-2">
                 <button
                   onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                   className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                 >
                   {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                 </button>
              </div>
            </div>
          </div>

          {/* Mobile Collapsible Menu */}
          {isMobileMenuOpen && (
            <div className="sm:hidden border-t border-slate-100 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 space-y-1.5 shadow-lg relative z-50 animate-in slide-in-from-top duration-200">
              {(user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_PO') || user?.permissions.includes('VIEW_APPROVAL_HUB')) && (
                <Link 
                  to="/purchase-head" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    isActive('/purchase-head')
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white border border-slate-200 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" /> Approval Hub
                </Link>
              )}
              <Link 
                to="/" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive('/') && !isActive('/saved') && !isActive('/saved-pos') && !isActive('/po-maker') && !isActive('/indents') && !isActive('/settings') && !isActive('/purchase-head')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-0.5"><rect width="18" height="18" x="3" y="3" rx="2.5"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M12 3v18"/></svg> Compare
              </Link>
              <Link 
                to="/saved" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive('/saved') && !isActive('/saved-pos')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Database className="w-4 h-4 text-indigo-500" /> Saved Tables
              </Link>
              <Link 
                to="/po-maker" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive('/po-maker')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <FileText className="w-4 h-4 text-indigo-500" /> PO Maker
              </Link>
              <Link 
                to="/saved-pos" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive('/saved-pos')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Database className="w-4 h-4 text-emerald-500" /> Saved POs
              </Link>
              <Link 
                to="/indents" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive('/indents')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <ClipboardList className="w-4 h-4 text-teal-500" /> Indents
              </Link>
              <Link 
                to="/settings" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive('/settings')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <SettingsIcon className="w-4 h-4 text-slate-500" /> Settings
              </Link>
              
              <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5">
                <button 
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-center px-4 py-2.5 rounded-xl text-[10px] font-black text-rose-500 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 transition-all uppercase tracking-wider cursor-pointer"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </nav>
      )}

      <main className="relative z-10">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Builder /></ProtectedRoute>} />
            <Route path="/saved" element={<ProtectedRoute><SavedTables /></ProtectedRoute>} />
            <Route path="/saved/:id" element={<ProtectedRoute><ViewTable /></ProtectedRoute>} />
            <Route path="/po-maker" element={<ProtectedRoute><POMaker /></ProtectedRoute>} />
            <Route path="/saved-pos" element={<ProtectedRoute><SavedPOs /></ProtectedRoute>} />
            <Route path="/indents" element={<ProtectedRoute><IndentDashboard /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><POSettings /></ProtectedRoute>} />
            <Route path="/purchase-head" element={<ProtectedRoute permission="VIEW_APPROVAL_HUB"><PurchaseHeadDashboard /></ProtectedRoute>} />
            <Route path="/approve-po/:id" element={<ProtectedRoute permission="VIEW_APPROVAL_HUB"><POApprovalView /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ApiCacheProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppContent />
          </BrowserRouter>
        </ApiCacheProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
