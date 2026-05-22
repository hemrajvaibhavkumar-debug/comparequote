import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Calendar, User, Factory, ChevronRight, FileText, CheckCircle, XCircle, Clock, ShieldCheck } from 'lucide-react';
import { useAuth } from './context/AuthContext';

export default function PurchaseHeadDashboard() {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const { token, logout, user } = useAuth();

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

  const filteredPOs = pos.filter(po => {
    const matchesSearch = po.po_no.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         po.vendor_name.toLowerCase().includes(searchTerm.toLowerCase());
    const poStatus = po.status || 'PENDING';
    const matchesStatus = statusFilter === 'ALL' || poStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</span>;
      case 'REJECTED':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="text-blue-600" /> Purchase Head Approval
            </h1>
            <p className="text-gray-500 font-medium">Welcome back, <span className="text-blue-600">@{user?.username}</span>. Review and sign pending POs.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search POs..." 
                className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-64"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="PENDING">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ALL">All POs</option>
            </select>
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
            {filteredPOs.map((po) => (
              <Link 
                key={po.id} 
                to={`/approve-po/${po.id}`}
                className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-600 transition-colors">
                      <FileText className="w-5 h-5 text-blue-600 group-hover:text-white" />
                    </div>
                    {getStatusBadge(po.status)}
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
                </div>
                
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-sm font-medium text-blue-600">
                  {po.status === 'PENDING' ? 'Review & Sign' : 'View Details'}
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
