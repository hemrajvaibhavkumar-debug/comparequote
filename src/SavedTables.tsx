import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Search, Filter, Calendar, User, Factory, ChevronRight, FileText, Trash2, Eye, ShieldCheck } from 'lucide-react';
import { useAuth } from './context/AuthContext';

export default function SavedTables() {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlant, setFilterPlant] = useState('');
  const [filterPreparedBy, setFilterPreparedBy] = useState('');
  
  const { token, user, logout } = useAuth();
  const canView = user?.role === 'SUPERADMIN' || user?.permissions.includes('VIEW_SAVED_TABLES');

  useEffect(() => {
    if (canView) {
      fetchTables();
    }
  }, [canView]);

  const fetchTables = () => {
    setLoading(true);
    fetch('/api/comparisons', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          logout();
          throw new Error("Session expired. Please log in again.");
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          // Sort by doc_no descending, handling the serial number
          const sorted = [...data].sort((a, b) => {
            const getParts = (doc: string) => {
              const parts = (doc || "").split("-");
              const prefix = parts[0] || "";
              const serial = parseInt(parts[parts.length - 1]) || 0;
              return { prefix, serial };
            };
            const da = getParts(a.doc_no);
            const db = getParts(b.doc_no);
            
            // First compare prefixes (lexicographically, e.g., C0626 > C0526)
            if (da.prefix !== db.prefix) return db.prefix.localeCompare(da.prefix);
            // Then compare serial numbers numerically
            return db.serial - da.serial;
          });
          setTables(sorted);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const deleteTable = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to delete this comparison?")) return;
    
    try {
      const res = await fetch(`/api/comparisons/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setTables(prev => prev.filter(t => t.id !== id));
      } else {
        alert("Failed to delete.");
      }
    } catch (err) {
      alert("Error deleting table.");
    }
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <ShieldCheck className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-black uppercase tracking-tight">Access Restricted</h2>
        <p className="text-gray-500 mt-2 max-w-md">You do not have the 'VIEW_SAVED_TABLES' permission required to access this database.</p>
        <Link to="/" className="mt-8 px-6 py-2 bg-black text-white rounded-lg font-bold text-xs uppercase tracking-widest">Back to Dashboard</Link>
      </div>
    );
  }

  const filteredTables = tables.filter(t => {
    const header = t.data?.header || {};
    const matchesSearch = t.doc_no.toLowerCase().includes(search.toLowerCase());
    const matchesPlant = !filterPlant || header.plantName === filterPlant;
    const matchesPreparedBy = !filterPreparedBy || header.preparedBy === filterPreparedBy;
    return matchesSearch && matchesPlant && matchesPreparedBy;
  });

  const plants = Array.from(new Set(tables.map(t => t.data?.header?.plantName).filter(Boolean)));
  const preparedBys = Array.from(new Set(tables.map(t => t.data?.header?.preparedBy).filter(Boolean)));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight uppercase">Saved Comparisons</h1>
          <p className="text-slate-400 font-semibold text-sm mt-1">Manage and view all your previous quotation comparisons</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl shadow-xs shrink-0">
          <FileText className="w-4 h-4" />
          <span className="font-extrabold">{filteredTables.length}</span> Total Records
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-2 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by Doc No..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 focus:border-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 text-slate-800 transition-all font-medium"
          />
        </div>
        
        <div className="relative group">
          <Factory className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
          <select 
            value={filterPlant}
            onChange={e => setFilterPlant(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 focus:border-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 text-slate-800 transition-all font-medium appearance-none cursor-pointer"
          >
            <option value="">All Plants</option>
            {plants.map(p => <option key={p as string} value={p as string}>{p as string}</option>)}
          </select>
        </div>

        <div className="relative group">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
          <select 
            value={filterPreparedBy}
            onChange={e => setFilterPreparedBy(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 focus:border-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 text-slate-800 transition-all font-medium appearance-none cursor-pointer"
          >
            <option value="">All Prepared By</option>
            {preparedBys.map(u => <option key={u as string} value={u as string}>{u as string}</option>)}
          </select>
        </div>
      </div>

      {/* List View */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Loading comparisons...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="p-16 text-center space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 bg-slate-50 border border-slate-150 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No comparisons found</h3>
            <p className="text-slate-400 text-sm font-medium">There are no records matching your current criteria.</p>
            <button onClick={() => { setSearch(''); setFilterPlant(''); setFilterPreparedBy(''); }} className="text-slate-900 text-xs font-bold hover:underline uppercase tracking-wider">Clear all filters</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Doc No.</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Plant Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Prepared By</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date Created</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTables.map(t => (
                  <tr key={t.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4.5">
                      <Link to={`/saved/${t.id}`} className="font-extrabold text-slate-900 group-hover:text-slate-900 transition-colors flex items-center gap-2">
                        {t.doc_no}
                        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                      </Link>
                    </td>
                    <td className="px-6 py-4.5">
                      <span className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold">
                        {t.data?.header?.plantName || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-2 text-sm text-slate-650 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {t.data?.header?.preparedBy || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-6 py-4.5 text-right">
                      <div className="flex justify-end gap-2.5">
                        <Link to={`/saved/${t.id}`} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200 rounded-xl transition-all shadow-none hover:shadow-xs" title="View Table">
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button onClick={(e) => deleteTable(t.id, e)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-black border border-transparent hover:border-slate-200 rounded-xl transition-all shadow-none hover:shadow-xs" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
