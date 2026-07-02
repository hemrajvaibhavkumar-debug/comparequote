import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Settings as SettingsIcon, FileText, Database, ShieldCheck, ClipboardList, Loader2, Menu, X, Mail } from 'lucide-react';
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
const ItAuditForm = lazy(() => import('./components/ItAudit/ItAuditForm').then(m => ({ default: m.default })));
const AutoInquiryMailer = lazy(() => import('./AutoInquiryMailer').then(m => ({ default: m.default })));

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

    // Special case for Approval Hub: allow either full approve (L1/L2) or read-only view
    if (permission === 'VIEW_APPROVAL_HUB') {
       if (userPermissions.includes('VIEW_APPROVAL_HUB') || userPermissions.includes('APPROVE_PO') || userPermissions.includes('APPROVE_PO_L1') || userPermissions.includes('VIEW_SAVED_POS')) {
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
    return `relative px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 flex items-center gap-1.5 border hover:scale-[1.02] active:scale-[0.98] ${
      active
        ? `bg-slate-100/80 dark:bg-slate-800/85 text-slate-950 dark:text-white border-slate-250 dark:border-slate-700/80 shadow-xs font-black`
        : 'text-slate-700 dark:text-slate-350 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-slate-900/40 border-transparent font-black'
    }`;
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 antialiased transition-colors duration-300">
      {isAuthenticated && (
        <nav className="glass-navbar sticky top-0 z-50 transition-standard">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center gap-4">
                <Link to="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-slate-900 dark:text-slate-100 hover:opacity-90 transition-opacity">
                  <span className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 shadow-md shadow-slate-200 dark:shadow-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2.5"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
                  </span>
                  <span className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent font-black tracking-tight">QuoteCompare</span>
                </Link>
                
                <div className="hidden lg:flex space-x-1 ml-4 items-center">
                  <Link to="/indents" className={navLinkStyle('/indents')}>
                    <ClipboardList className="w-3.5 h-3.5 text-sky-500" /> Indents
                  </Link>
                  <Link to="/inquiry-mailer" className={navLinkStyle('/inquiry-mailer')}>
                    <Mail className="w-3.5 h-3.5 text-pink-500" /> Auto Inquiry Mailer
                  </Link>
                  <Link to="/" className={navLinkStyle('/')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-0.5 text-emerald-500"><rect width="18" height="18" x="3" y="3" rx="2.5"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M12 3v18"/></svg> Compare
                  </Link>
                  <Link to="/saved" className={navLinkStyle('/saved', 'slate', isActive('/saved') && !isActive('/saved-pos'))}>
                    <Database className="w-3.5 h-3.5 text-indigo-500" /> Saved Tables
                  </Link>
                  
                  <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>
                  
                  <Link to="/po-maker" className={navLinkStyle('/po-maker')}>
                    <FileText className="w-3.5 h-3.5 text-violet-500" /> PO Maker
                  </Link>
                  <Link to="/saved-pos" className={navLinkStyle('/saved-pos')}>
                    <Database className="w-3.5 h-3.5 text-purple-500" /> Saved POs
                  </Link>
                  
                  {(user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_PO') || user?.permissions.includes('APPROVE_PO_L1') || user?.permissions.includes('VIEW_APPROVAL_HUB')) && (
                    <Link to="/purchase-head" className={navLinkStyle('/purchase-head')}>
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-500" /> Approval Hub
                    </Link>
                  )}
                  {/* Hide IT Audit for now
                  <Link to="/it-audit" className={navLinkStyle('/it-audit')}>
                    <ClipboardList className="w-3.5 h-3.5 text-orange-500" /> IT Audit
                  </Link>
                  */}
                  <Link to="/settings" className={navLinkStyle('/settings')}>
                    <SettingsIcon className="w-3.5 h-3.5 text-slate-500" /> Settings
                  </Link>
                </div>
              </div>
              
              {/* Desktop Menu Buttons & Profile */}
              <div className="hidden lg:flex items-center gap-3">
                 <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 rounded-xl">
                   <div className="w-6 h-6 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-[11px] border border-orange-200/40">
                     {user?.username?.charAt(0).toUpperCase() || 'U'}
                   </div>
                   <div className="flex flex-col text-left">
                     <span className="text-[9px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 leading-none">
                       {user?.username || 'User'}
                     </span>
                     <span className="text-[7.5px] font-bold text-slate-400 dark:text-slate-500 tracking-tight leading-none mt-0.5">
                       {user?.role || 'EMPLOYEE'}
                     </span>
                   </div>
                 </div>
                 <button 
                   onClick={logout}
                   className="px-3.5 py-1.5 rounded-xl text-[9px] font-black text-rose-500 bg-rose-50/50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/45 border border-rose-200/50 dark:border-rose-900/50 transition-all duration-200 uppercase tracking-widest cursor-pointer shadow-xs active:scale-95"
                 >
                   Logout
                 </button>
              </div>

              {/* Mobile Hamburger Button */}
              <div className="flex lg:hidden items-center gap-2">
                 <button
                   onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                   className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-all cursor-pointer"
                 >
                   {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                 </button>
              </div>
            </div>
          </div>

          {/* Mobile Collapsible Menu */}
          {isMobileMenuOpen && (
            <div className="lg:hidden border-t border-slate-100 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 space-y-1.5 shadow-lg relative z-50 animate-in slide-in-from-top duration-200">
              
              {/* Mobile User Info Info Block */}
              <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-black text-sm border border-orange-200/40">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {user?.username || 'User'}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-tight mt-0.5">
                    {user?.role || 'EMPLOYEE'}
                  </span>
                </div>
              </div>

              {(user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_PO') || user?.permissions.includes('APPROVE_PO_L1') || user?.permissions.includes('VIEW_APPROVAL_HUB')) && (
                <Link 
                  to="/purchase-head" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    isActive('/purchase-head')
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white border border-slate-200 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-rose-500" /> Approval Hub
                </Link>
              )}
              <Link 
                to="/" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive('/') && !isActive('/saved') && !isActive('/saved-pos') && !isActive('/po-maker') && !isActive('/indents') && !isActive('/inquiry-mailer') && !isActive('/settings') && !isActive('/purchase-head')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-0.5 text-emerald-500"><rect width="18" height="18" x="3" y="3" rx="2.5"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M12 3v18"/></svg> Compare
              </Link>
              <Link 
                to="/saved" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive('/saved') && !isActive('/saved-pos')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800'
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
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800'
                }`}
              >
                <FileText className="w-4 h-4 text-violet-500" /> PO Maker
              </Link>
              <Link 
                to="/saved-pos" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive('/saved-pos')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800'
                }`}
              >
                <Database className="w-4 h-4 text-purple-500" /> Saved POs
              </Link>
              <Link 
                to="/indents" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive('/indents')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800'
                }`}
              >
                <ClipboardList className="w-4 h-4 text-sky-500" /> Indents
              </Link>
              <Link 
                to="/inquiry-mailer" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive('/inquiry-mailer')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800'
                }`}
              >
                <Mail className="w-4 h-4 text-pink-500" /> Auto Inquiry Mailer
              </Link>
              {/* Hide IT Audit for now
              <Link 
                to="/it-audit" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive('/it-audit')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800'
                }`}
              >
                <ClipboardList className="w-4 h-4 text-orange-500" /> IT Audit
              </Link>
              */}
              <Link 
                to="/settings" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive('/settings')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800'
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
                  className="w-full text-center px-4 py-2.5 rounded-xl text-[10px] font-black text-rose-500 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 transition-all uppercase tracking-widest border border-rose-200/50 dark:border-rose-900/50 cursor-pointer"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </nav>
      )}

      <main className="relative">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Builder /></ProtectedRoute>} />
            <Route path="/saved" element={<ProtectedRoute><SavedTables /></ProtectedRoute>} />
            <Route path="/saved/:id" element={<ProtectedRoute><ViewTable /></ProtectedRoute>} />
            <Route path="/po-maker" element={<ProtectedRoute><POMaker /></ProtectedRoute>} />
            <Route path="/saved-pos" element={<ProtectedRoute><SavedPOs /></ProtectedRoute>} />
            <Route path="/indents" element={<ProtectedRoute><IndentDashboard /></ProtectedRoute>} />
            <Route path="/inquiry-mailer" element={<ProtectedRoute><AutoInquiryMailer /></ProtectedRoute>} />
            <Route path="/it-audit" element={<ProtectedRoute><ItAuditForm /></ProtectedRoute>} />
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
