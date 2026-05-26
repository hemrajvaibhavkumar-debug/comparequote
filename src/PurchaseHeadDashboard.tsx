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
      setPos(data);
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
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</span>;
      case 'REJECTED':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 uppercase tracking-tight">
              <ShieldCheck className="text-blue-600 w-7 h-7" /> Purchase Approval Hub
            </h1>
            <p className="text-gray-500 font-medium">Welcome back, <span className="text-blue-600">@{user?.username}</span>. Review and sign pending POs.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Search POs..." 
                className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none w-full sm:w-64 transition-all text-sm font-medium"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center bg-gray-100 border border-gray-200 rounded-xl p-1 shrink-0">
              {[
                { id: 'PENDING', label: 'Pending' },
                { id: 'APPROVED', label: 'Approved' },
                { id: 'REJECTED', label: 'Rejected' },
                { id: 'ALL', label: 'All POs' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    statusFilter === f.id 
                      ? 'bg-white text-blue-600 shadow-sm border border-gray-100' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredPOs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="text-gray-400 w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No purchase orders found</h3>
            <p className="text-gray-500 mt-1">There are no POs matching your current filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPOs.map((po) => {
              const poStatus = po.status || 'PENDING';
              const isActioning = actioningId === po.id;

              return (
                <div 
                  key={po.id} 
                  className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group overflow-hidden relative flex flex-col"
                >
                  <Link to={`/approve-po/${po.id}`} className="p-5 flex-1 cursor-pointer">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-600 transition-colors">
                        <FileText className="w-5 h-5 text-blue-600 group-hover:text-white" />
                      </div>
                      {getStatusBadge(poStatus)}
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      PO #{po.po_no}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-1">{po.vendor_name}</p>
                    
                    <div className="space-y-2 pt-4 border-t border-gray-50">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        {new Date(po.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-900 font-bold">
                        <span className="text-gray-500 font-normal italic">Amount:</span>
                        ₹{po.total_amount.toLocaleString()}
                      </div>
                    </div>
                  </Link>
                  
                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    {poStatus === 'PENDING' && canApprove ? (
                      <div className="flex items-center gap-2 w-full">
                        <button 
                          onClick={(e) => handleQuickStatusUpdate(po.id, 'REJECTED', e)}
                          disabled={isActioning}
                          className="flex-1 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-50 disabled:opacity-50 transition-all flex items-center justify-center gap-1"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                        <button 
                          onClick={(e) => handleQuickStatusUpdate(po.id, 'APPROVED', e)}
                          disabled={isActioning}
                          className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                      </div>
                    ) : (
                      <Link 
                        to={`/approve-po/${po.id}`}
                        className="w-full text-center text-xs font-bold text-blue-600 hover:underline flex items-center justify-center gap-2 uppercase tracking-widest"
                      >
                        {poStatus === 'APPROVED' ? 'View Document' : poStatus === 'REJECTED' ? 'View Rejection' : 'Review Details'}
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>

                  {isActioning && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
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
