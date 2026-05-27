import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Calendar, User, Factory, ChevronRight, FileText, CheckCircle, XCircle, Clock, ShieldCheck } from 'lucide-react';
import { useAuth } from './context/AuthContext';

export default function PurchaseHeadDashboard() {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [actioningId, setActioningId] = useState<number | null>(null);
  const { token, logout, user } = useAuth();
  
  const canApprove = user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_PO');

  useEffect(() => {
    fetchPOs();
  }, [statusFilter]);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/po', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }

      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setPos(data);
      } else {
        console.error("Failed to fetch POs: Expected array but received", data);
        setPos([]);
      }
    } catch (e) {
      console.error("Failed to fetch POs", e);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStatusUpdate = async (id: number, newStatus: 'APPROVED' | 'REJECTED', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm(`Are you sure you want to ${newStatus.toLowerCase()} PO #${pos.find(p => p.id === id)?.po_no}?`)) return;

    try {
      setActioningId(id);
      const res = await fetch(`/api/po/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (res.ok) {
        // Refresh local state
        setPos(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
      } else {
        alert("Failed to update status");
      }
    } catch (e) {
      console.error(e);
      alert("Error updating status");
    } finally {
      setActioningId(null);
    }
  };

  const filteredPOs = pos.filter(po => {
    const matchesSearch = po.po_no.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         po.vendor_name.toLowerCase().includes(searchTerm.toLowerCase());
    const poStatus = po.status || 'PENDING';
    const matchesStatus = statusFilter === 'ALL' || poStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const s = status || 'PENDING';
    switch (s) {
      case 'APPROVED':
        return <span className="px-2 py-1 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</span>;
      case 'REJECTED':
        return <span className="px-2 py-1 bg-white border border-slate-900 text-slate-900 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border border-slate-200"><Clock className="w-3 h-3" /> Pending</span>;
    }
  };

  const totalCount = pos.length;
  const pendingCount = pos.filter(p => (p.status || 'PENDING') === 'PENDING').length;
  const approvedCount = pos.filter(p => p.status === 'APPROVED').length;
  const combinedValue = pos.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-8 relative">
      {/* Background ambient glows */}
      <div className="ambient-glow bg-slate-200/50 -top-20 -left-20" style={{ width: '400px', height: '400px' }}></div>
      <div className="ambient-glow bg-slate-100/50 bottom-10 right-10" style={{ width: '400px', height: '400px' }}></div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xs border border-slate-100">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5 uppercase tracking-tight">
              <ShieldCheck className="text-slate-900 w-7 h-7" /> Purchase Approval Hub
            </h1>
            <p className="text-slate-400 font-semibold text-sm mt-0.5">Welcome back, <span className="text-slate-900 font-black">@{user?.username}</span>. Review, sign, and authorize pending POs.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 items-center shrink-0">
            <div className="relative group w-full sm:w-auto">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
              <input 
                type="text" 
                placeholder="Search POs..." 
                className="pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 w-full sm:w-64 transition-all text-sm font-medium text-slate-800"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1 shrink-0">
              {[
                { id: 'PENDING', label: 'Pending' },
                { id: 'APPROVED', label: 'Approved' },
                { id: 'REJECTED', label: 'Rejected' },
                { id: 'ALL', label: 'All POs' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    statusFilter === f.id 
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-100' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dashboard Analytics Banner Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
            <div className="p-3.5 bg-slate-50 rounded-2xl text-slate-900">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Actions</span>
              <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{totalCount} POs</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 border-l-4 border-l-slate-400">
            <div className="p-3.5 bg-slate-50 rounded-2xl text-slate-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Awaiting Sign</span>
              <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{pendingCount} POs</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 border-l-4 border-l-slate-900">
            <div className="p-3.5 bg-slate-50 rounded-2xl text-slate-900">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Approved Value</span>
              <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{approvedCount} POs</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 border-l-4 border-l-black">
            <div className="p-3.5 bg-slate-900 rounded-2xl text-white">
              <span className="text-sm font-extrabold">₹</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Combined Value</span>
              <h3 className="text-md font-black text-slate-900 mt-0.5">₹{combinedValue.toLocaleString('en-IN')}</h3>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900"></div>
          </div>
        ) : filteredPOs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xs p-16 text-center border border-slate-100 max-w-2xl mx-auto space-y-4">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <FileText className="text-slate-350 w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">No purchase orders found</h3>
            <p className="text-slate-400 text-sm font-medium">There are currently no POs matching your chosen status filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPOs.map((po) => {
              const poStatus = po.status || 'PENDING';
              const isActioning = actioningId === po.id;

              return (
                <div 
                  key={po.id} 
                  className="bg-white rounded-2xl shadow-xs border border-slate-100 hover:shadow-md hover:border-slate-300 transition-all duration-300 group overflow-hidden relative flex flex-col"
                >
                  <Link to={`/approve-po/${po.id}`} className="p-6 flex-1 cursor-pointer">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2.5 bg-slate-100 text-slate-900 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-all shadow-xs duration-300">
                        <FileText className="w-5 h-5" />
                      </div>
                      {getStatusBadge(poStatus)}
                    </div>
                    
                    <h3 className="text-lg font-extrabold text-slate-850 group-hover:text-slate-900 transition-colors uppercase tracking-tight">
                      PO #{po.po_no}
                    </h3>
                    <p className="text-sm text-slate-500 mb-2 line-clamp-1 font-semibold uppercase tracking-tight">{po.vendor_name}</p>
                    {po.created_by_name && (
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-4 flex items-center gap-1">
                        <User className="w-3 h-3" /> By: {po.created_by_name}
                      </p>
                    )}
                    
                    <div className="space-y-2 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold uppercase">
                        <Calendar className="w-4 h-4 text-slate-350" />
                        {new Date(po.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-850 font-black">
                        <span className="text-slate-400 font-semibold text-xs uppercase tracking-wider">Amount:</span>
                        ₹{po.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      {poStatus === 'REJECTED' && po.rejection_remarks && (
                        <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                          <p className="text-[9px] font-bold text-slate-900 uppercase tracking-tighter mb-0.5">Rejection Reason:</p>
                          <p className="text-[10px] text-slate-600 font-medium leading-tight italic line-clamp-2">
                            "{po.rejection_remarks}"
                          </p>
                        </div>
                      )}
                    </div>
                  </Link>
                  
                  <div className="px-6 py-3.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between shrink-0">
                    {poStatus === 'PENDING' && canApprove ? (
                      <div className="flex items-center gap-3.5 w-full">
                        <button 
                          onClick={(e) => handleQuickStatusUpdate(po.id, 'REJECTED', e)}
                          disabled={isActioning}
                          className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button 
                          onClick={(e) => handleQuickStatusUpdate(po.id, 'APPROVED', e)}
                          disabled={isActioning}
                          className="flex-1 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black disabled:opacity-50 transition-all shadow-md shadow-slate-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                      </div>
                    ) : (
                      <Link 
                        to={`/approve-po/${po.id}`}
                        className="w-full text-center text-xs font-black text-slate-900 hover:underline flex items-center justify-center gap-2 uppercase tracking-widest"
                      >
                        {poStatus === 'APPROVED' ? 'View Final Document' : poStatus === 'REJECTED' ? 'View Rejection Details' : 'Review Details'}
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    )}
                  </div>

                  {isActioning && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                      <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-slate-900"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
