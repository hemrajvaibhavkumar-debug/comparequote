import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Settings as SettingsIcon, FileText, Database, ShieldCheck, ClipboardList, Loader2 } from 'lucide-react';
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
        ? `bg-slate-100/80 text-slate-900 border-slate-200 shadow-sm`
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-transparent'
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
                  <span className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-md shadow-slate-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2.5"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
                  </span>
                  <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent font-black tracking-tight">QuoteCompare</span>
                </Link>
                
                <div className="hidden sm:flex space-x-1.5 ml-4 items-center">
                  {(user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_PO') || user?.permissions.includes('VIEW_APPROVAL_HUB')) && (
                    <Link to="/purchase-head" className={navLinkStyle('/purchase-head')}>
                      <ShieldCheck className="w-4 h-4" /> Approval Hub
                    </Link>
                  )}

                  <Link to="/" className={navLinkStyle('/')}>Compare</Link>
                  <Link to="/saved" className={navLinkStyle('/saved', 'slate', isActive('/saved') && !isActive('/saved-pos'))}>Saved Tables</Link>
                  
                  <div className="h-5 w-px bg-slate-200 mx-2"></div>
                  
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
              <div className="flex items-center">
                 <button 
                   onClick={logout}
                   className="px-4 py-1.5 rounded-xl text-[10px] font-black text-slate-600 hover:text-white hover:bg-slate-900 border border-slate-200 hover:border-slate-900 transition-all duration-200 uppercase tracking-wider cursor-pointer shadow-xs hover:shadow-sm"
                 >
                   Logout
                 </button>
              </div>
            </div>
          </div>
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
