import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PurchaseOrder } from './types';
import { FileText, Eye, Edit, Trash2, Search, ArrowLeft, ShieldCheck, CheckCircle, XCircle, Clock, Filter, ChevronRight, IndianRupee } from 'lucide-react';
import { useAuth } from './context/AuthContext';

const SavedPOs: React.FC = () => {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const navigate = useNavigate();
  
  const { token, user, logout } = useAuth();
  const canView = user?.role === 'SUPERADMIN' || user?.permissions.includes('VIEW_SAVED_POS');

  useEffect(() => {
    if (canView) {
      fetchPOs();
    }
  }, [canView]);

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
      if (res.ok) {
        const data = await res.json();
        setPos(data);
      }
    } catch (err) {
      console.error('Failed to fetch POs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this PO?')) return;
    
    try {
      const res = await fetch(`/api/po/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setPos(pos.filter(po => po.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete PO', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status || 'PENDING';
    switch (s) {
      case 'APPROVED':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-wider">Approved</span>
          </div>
        );
      case 'REJECTED':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-red-700 rounded-full border border-rose-100">
            <XCircle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-wider">Rejected</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-wider">Pending</span>
          </div>
        );
    }
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white m-8 rounded-2xl border border-black shadow-sm">
        <ShieldCheck className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-black uppercase tracking-tight">Access Restricted</h2>
        <p className="text-gray-500 mt-2 max-w-md">You do not have the 'VIEW_SAVED_POS' permission required to view the Purchase Order database.</p>
        <Link to="/" className="mt-8 px-6 py-2 bg-black text-white rounded-lg font-bold text-xs uppercase tracking-widest">Back to Dashboard</Link>
      </div>
    );
  }

  const filteredPOs = pos.filter(po => {
    const matchesSearch = po.po_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         po.vendor_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || (po.status || 'PENDING') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Dynamic Full-Width Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-2.5 hover:bg-gray-100 rounded-xl transition-all border border-transparent hover:border-gray-200"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">PO Database</h1>
              <p className="text-sm text-gray-500 font-medium">Manage and track all finalized purchase orders</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" />
              <input 
                type="text"
                placeholder="Search POs..."
                className="pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl w-full md:w-72 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm font-medium"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1">
              {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    statusFilter === f 
                      ? 'bg-white text-black shadow-sm border border-gray-100' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full-Width Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black"></div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading Records...</p>
          </div>
        ) : filteredPOs.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-200">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">PO Details</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Vendor Information</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Grand Total</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">Workflow Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPOs.map((po) => (
                    <tr key={po.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">#{po.po_no}</span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase mt-1 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" /> {new Date(po.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 uppercase text-xs tracking-tight truncate max-w-xs">{po.vendor_name}</span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">GST: {po.vendor_details.gstin || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-0.5 text-sm font-black text-gray-900">
                            <IndianRupee className="w-3.5 h-3.5" />
                            {Number(po.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          <span className="text-[9px] font-bold text-gray-400 uppercase mt-1">Total Payable</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-center">
                          {getStatusBadge(po.status || 'PENDING')}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-end items-center gap-2">
                          {po.status !== 'APPROVED' && (
                            <button 
                              onClick={() => navigate(`/po-maker?edit=${po.id}`)}
                              className="p-2 text-gray-400 hover:text-black hover:bg-white border border-transparent hover:border-gray-200 rounded-xl transition-all shadow-none hover:shadow-sm"
                              title="Edit Revision"
                            >
                              <Edit className="w-4.5 h-4.5" />
                            </button>
                          )}
                          <Link 
                            to={`/approve-po/${po.id}`}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white border border-transparent hover:border-gray-200 rounded-xl transition-all shadow-none hover:shadow-sm"
                            title="View Document"
                          >
                            <Eye className="w-4.5 h-4.5" />
                          </Link>
                          {po.status !== 'APPROVED' && (
                            <button 
                              onClick={() => handleDelete(po.id!)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-white border border-transparent hover:border-gray-200 rounded-xl transition-all shadow-none hover:shadow-sm"
                              title="Delete PO"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          )}
                          <div className="w-6 flex justify-center text-gray-300 ml-2">
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform group-hover:text-black" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-32 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm max-w-2xl mx-auto">
            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 uppercase tracking-tight">No Records Found</h3>
            <p className="text-gray-500 mt-2 font-medium">Try adjusting your filters or search terms.</p>
            <Link to="/po-maker" className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black/90 transition-all shadow-lg">
              Create New PO
            </Link>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {!loading && filteredPOs.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-black text-white rounded-full shadow-2xl flex items-center gap-6 border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2 border-r border-white/20 pr-6">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-tighter">Total POs</span>
            <span className="text-sm font-black">{filteredPOs.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-tighter">Combined Value</span>
            <div className="flex items-center text-sm font-black text-emerald-400">
               <IndianRupee className="w-3.5 h-3.5" />
               {filteredPOs.reduce((acc, po) => acc + (Number(po.total_amount) || 0), 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedPOs;
