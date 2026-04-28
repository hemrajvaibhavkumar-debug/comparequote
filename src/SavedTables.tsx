import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Calendar, User, Factory, ChevronRight, FileText, Trash2, Eye } from 'lucide-react';

export default function SavedTables() {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlant, setFilterPlant] = useState('');
  const [filterPreparedBy, setFilterPreparedBy] = useState('');

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = () => {
    setLoading(true);
    fetch('/api/comparisons', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTables(data);
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
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
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
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Saved Comparisons</h1>
          <p className="text-slate-500 mt-1">Manage and view all your previous quotation comparisons</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200">
          <FileText className="w-4 h-4 text-indigo-500" />
          <span className="font-bold text-slate-700">{filteredTables.length}</span> Total Records
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by Doc No..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
          />
        </div>
        
        <div className="relative">
          <Factory className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select 
            value={filterPlant}
            onChange={e => setFilterPlant(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
          >
            <option value="">All Plants</option>
            {plants.map(p => <option key={p as string} value={p as string}>{p as string}</option>)}
          </select>
        </div>

        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select 
            value={filterPreparedBy}
            onChange={e => setFilterPreparedBy(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
          >
            <option value="">All Prepared By</option>
            {preparedBys.map(u => <option key={u as string} value={u as string}>{u as string}</option>)}
          </select>
        </div>
      </div>

      {/* List View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 font-medium">Loading comparisons...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">No matches found for your criteria.</p>
            <button onClick={() => { setSearch(''); setFilterPlant(''); setFilterPreparedBy(''); }} className="text-indigo-600 text-sm font-bold hover:underline">Clear all filters</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doc No.</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plant Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prepared By</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTables.map(t => (
                  <tr key={t.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link to={`/saved/${t.id}`} className="font-bold text-slate-700 group-hover:text-indigo-600 flex items-center gap-2">
                        {t.doc_no}
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                        {t.data?.header?.plantName || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <User className="w-3 h-3 text-slate-400" />
                        {t.data?.header?.preparedBy || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {new Date(t.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link to={`/saved/${t.id}`} className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all" title="View Table">
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button onClick={(e) => deleteTable(t.id, e)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all" title="Delete">
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
