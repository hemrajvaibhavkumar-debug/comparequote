import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function SavedTables() {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Saved Comparisons</h1>
      {loading ? (
        <p>Loading...</p>
      ) : tables.length === 0 ? (
        <p className="text-slate-500">No saved tables found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tables.map(t => (
            <Link key={t.id} to={`/saved/${t.id}`} className="block group">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-indigo-300 transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {t.doc_no}
                    </h3>
                    <p className="text-sm text-slate-500 mt-2">
                      Saved on {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
