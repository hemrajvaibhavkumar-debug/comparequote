import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, Table as TableIcon, Loader2, Plus, Trash2, Eye, Settings as SettingsIcon, X, RotateCcw, ShieldCheck } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { extractQuotations } from './services/gemini';
import { ComparisonData, HeaderInfo } from './types';
import { ComparisonTable } from './components/ComparisonTable';
import * as Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
import { useAuth } from './context/AuthContext';
import { useApiCache } from './context/ApiCacheContext';

declare const google: any;

interface DBExecutive { id: number; name: string; designation?: string; }
interface DBPlant { id: number; name: string; location?: string; }

const Builder: React.FC = () => {
  const { token, user, logout } = useAuth();
  const { fetchMasters: getMastersFromCache, invalidateMasters, invalidateComparisons } = useApiCache();
  const canExtract = user?.role === 'SUPERADMIN' || user?.permissions.includes('ACCESS_COMPARE');
  const canManageSettings = user?.role === 'SUPERADMIN' || user?.permissions.includes('MANAGE_SETTINGS');

  // State with LocalStorage persistence (Auto-save draft)
  const [header, setHeader] = useState<HeaderInfo>(() => {
    const saved = localStorage.getItem('quote_draft_header');
    return saved ? JSON.parse(saved) : {
      docNo: '',
      preparedBy: '',
      date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      indentDate: '',
      plantName: ''
    };
  });

  const [dbExecutives, setDbExecutives] = useState<DBExecutive[]>([]);
  const [dbPlants, setDbPlants] = useState<DBPlant[]>([]);
  const [selectedExecutiveId, setSelectedExecutiveId] = useState<number | null>(null);
  const [selectedPlantId, setSelectedPlantId] = useState<number | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [newPreparedBy, setNewPreparedBy] = useState('');
  const [newPreparedByDesignation, setNewPreparedByDesignation] = useState('');
  const [newPlantName, setNewPlantName] = useState('');
  const [newPlantLocation, setNewPlantLocation] = useState('');

  const [data, setData] = useState<ComparisonData>(() => {
    const saved = localStorage.getItem('quote_draft_data');
    return saved ? JSON.parse(saved) : { items: [], vendors: [], multiplyByWeight: false };
  });

  const [inputText, setInputText] = useState('');
  const [extractionPrompt, setExtractionPrompt] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [files, setFiles] = useState<{ name: string; mimeType: string; data: string }[]>([]);
  const [fontSize, setFontSize] = useState<number>(11);
  
  const tableRef = useRef<HTMLDivElement>(null);

  // Auto-save effect
  useEffect(() => {
    localStorage.setItem('quote_draft_header', JSON.stringify(header));
  }, [header]);

  useEffect(() => {
    localStorage.setItem('quote_draft_data', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem('quote_table_font_size', fontSize.toString());
  }, [fontSize]);

  const generateDocNo = async (force = false) => {
    // Only generate if docNo is empty, unless forced
    if (header.docNo && !force) return;

    try {
      const res = await fetch('/api/comparisons/latest-year', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }
      
      const { latest } = await res.json();
      
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      
      let serial = 1;
      if (latest) {
        // Extract the numerical part after the last dash
        const parts = latest.split('-');
        const lastPart = parts[parts.length - 1];
        const lastSerial = parseInt(lastPart);
        if (!isNaN(lastSerial)) {
          serial = lastSerial + 1;
        }
      }
      
      const newDocNo = `C${mm}${yy}-${serial}`;
      setHeader(prev => ({ ...prev, docNo: newDocNo }));
    } catch (e) {
      console.error("Error generating Doc No", e);
    }
  };

  useEffect(() => {
    fetchMasters();
    // Always try to fetch/generate latest Doc No on mount if it's currently empty
    generateDocNo();
    const savedFontSize = localStorage.getItem('quote_table_font_size');
    if (savedFontSize) setFontSize(parseInt(savedFontSize));
  }, []);

  const fetchMasters = async (forceRefresh = false) => {
    try {
      const d = await getMastersFromCache(forceRefresh);
      if (d.executives) setDbExecutives(d.executives);
      if (d.plants) setDbPlants(d.plants);
    } catch (e) {
      console.error("Error fetching masters", e);
    }
  };

  const addExecutive = async () => {
    if (!newPreparedBy.trim()) return;
    try {
      const res = await fetch('/api/executives', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newPreparedBy, designation: newPreparedByDesignation })
      });
      if (res.ok) {
        setNewPreparedBy('');
        setNewPreparedByDesignation('');
        invalidateMasters();
        fetchMasters(true);
      }
    } catch (e) { alert("Error adding executive"); }
  };

  const removeExecutive = async (id: number) => {
    if (!window.confirm("Delete this executive?")) return;
    try {
      const res = await fetch(`/api/executives/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        invalidateMasters();
        fetchMasters(true);
      }
    } catch (e) { alert("Error deleting executive"); }
  };

  const addPlant = async () => {
    if (!newPlantName.trim()) return;
    try {
      const res = await fetch('/api/plants', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newPlantName, location: newPlantLocation })
      });
      if (res.ok) {
        setNewPlantName('');
        setNewPlantLocation('');
        invalidateMasters();
        fetchMasters(true);
      }
    } catch (e) { alert("Error adding plant"); }
  };

  const removePlant = async (id: number) => {
    if (!window.confirm("Delete this plant?")) return;
    try {
      const res = await fetch(`/api/plants/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        invalidateMasters();
        fetchMasters(true);
      }
    } catch (e) { alert("Error deleting plant"); }
  };

  const clearDraft = () => {
    if (window.confirm("Are you sure you want to clear the current draft?")) {
      const freshHeader = { docNo: '', preparedBy: '', date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), indentDate: '', plantName: '' };
      const freshData = { items: [], vendors: [] };
      setHeader(freshHeader);
      setData(freshData);
      setInputText('');
      setFiles([]);
      localStorage.removeItem('quote_draft_header');
      localStorage.removeItem('quote_draft_data');
      // Regenerate doc no for the new fresh draft
      setTimeout(() => generateDocNo(true), 100);
    }
  };

  const saveToNeon = async () => {
    if (!header.docNo) {
      alert("Please enter a Doc No. before saving.");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        doc_no: header.docNo,
        data: { header, data },
        executive_id: selectedExecutiveId,
        plant_id: selectedPlantId
      };
      const res = await fetch('/api/comparisons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save.");
      }
      invalidateComparisons();
      alert("Successfully saved to database!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const onDrop = React.useCallback(async (acceptedFiles: File[]) => {
    const newFiles = await Promise.all(acceptedFiles.map(async (file) => {
      return new Promise<{ name: string; mimeType: string; data: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({ name: file.name, mimeType: file.type, data: base64 });
        };
        reader.readAsDataURL(file);
      });
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  // Global paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea';

      if (!e.clipboardData) return;

      const pastedFiles: File[] = [];

      Array.from(e.clipboardData.items).forEach(item => {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        } else if (item.kind === 'string' && item.type === 'text/plain' && !isInput) {
          item.getAsString(text => {
            setInputText(prev => prev ? prev + '\n\n' + text : text);
          });
        }
      });

      if (pastedFiles.length > 0) {
        e.preventDefault();
        onDrop(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste as EventListener);
    return () => window.removeEventListener('paste', handlePaste as EventListener);
  }, [onDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpeg', '.jpg', '.png'] },
    multiple: true,
    noClick: true,
    noKeyboard: true
  });

  const handleExtract = async () => {
    setIsExtracting(true);
    try {
      const extracted = await extractQuotations(inputText, files, extractionPrompt);
      if (extracted?.items) {
        extracted.items = extracted.items.map((item) => {
          const processedQuotes = item.vendorQuotes?.map((q: any) => {
            let nr = parseFloat(q.netRate) || 0;
            let mrp = parseFloat(q.mrp) || 0;
            const disc = parseFloat(q.discount) || 0;
            const qty = Number(item.qty) || 0;
            const weight = Number(item.weight) || 0;
            const multiplier = (data.multiplyByWeight && weight > 0) ? weight : qty;

            // Enforce Discount as Percentage
            if (disc > 0 && mrp > 0) {
              // If discount and MRP are present, netRate is always calculated from them
              nr = mrp * (1 - disc / 100);
            } else if (disc === 0) {
              // If no discount, sync MRP and NetRate
              if (nr > 0 && mrp === 0) mrp = nr;
              else if (mrp > 0 && nr === 0) nr = mrp;
            } else if (nr > 0 && mrp > 0 && disc === 0) {
               // Optional: calculate discount if missing? (Not requested, but keeping it simple)
            }

            return {
              ...q,
              mrp: Number(mrp.toFixed(2)),
              discount: disc, // Keep the numeric percentage
              netRate: Number(nr.toFixed(2)),
              totalAmount: Number((nr * multiplier).toFixed(2))
            };
          });

          return { 
            ...item, 
            siNo: "", 
            indentNo: "",
            vendorQuotes: processedQuotes
          };
        });

        // MERGE LOGIC
        setData(prev => {
          const newVendors = [...new Set([...(prev.vendors || []), ...(extracted.vendors || [])])];
          
          const mergedItems = [...(prev.items || [])];
          
          extracted.items.forEach((newItem: any) => {
            const existingItemIndex = mergedItems.findIndex(
              ei => ei.description?.toLowerCase().replace(/\s+/g, '') === newItem.description?.toLowerCase().replace(/\s+/g, '')
            );
            
            if (existingItemIndex > -1) {
              // Merge quotes for existing item
              const existingItem = mergedItems[existingItemIndex];
              const existingQuotes = existingItem.vendorQuotes || [];
              const newQuotes = newItem.vendorQuotes || [];
              
              // To avoid exact duplicate quotes from same vendor if re-scanned
              const uniqueNewQuotes = newQuotes.filter((nq: any) => 
                !existingQuotes.some((eq: any) => eq.vendorName === nq.vendorName)
              );
              
              mergedItems[existingItemIndex] = {
                ...existingItem,
                vendorQuotes: [...existingQuotes, ...uniqueNewQuotes]
              };
            } else {
              // Add as new item
              mergedItems.push(newItem);
            }
          });
          
          return {
            ...prev,
            vendors: newVendors,
            items: mergedItems
          };
        });

        // Clear input text and files after successful extraction to prevent duplicates on next click
        setInputText('');
        setFiles([]);
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to extract quotations.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div {...getRootProps()} className={`min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans transition-colors relative ${isDragActive ? 'bg-slate-100/60' : ''}`}>
      {isDragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-xs pointer-events-none border-4 border-black border-dashed m-4 rounded-3xl animate-pulse-slow">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-black/10">
            <Upload className="w-16 h-16 text-black animate-bounce" />
            <p className="text-xl font-bold text-slate-800">Drop files anywhere to upload</p>
            <p className="text-xs text-slate-400 font-medium">QuoteCompare AI will extract quotations automatically</p>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* Background ambient blobs - Neutralized */}
        <div className="ambient-glow ambient-slate -top-40 -left-40 animate-pulse-slow print-hidden" style={{ width: '350px', height: '350px' }}></div>
        <div className="ambient-glow ambient-slate top-60 right-0 animate-pulse-slow print-hidden" style={{ animationDelay: '3s', width: '350px', height: '350px' }}></div>

        <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-200 print-hidden transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center shadow-lg shadow-slate-200 animate-float">
              <TableIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Compare Workspace</h1>
              <p className="text-slate-500 text-xs font-semibold mt-0.5">Analyze, refine, and merge multiple quotations</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <button onClick={saveToNeon} disabled={isSaving || !data.items.length} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-black disabled:opacity-50 transition-all shadow-md shadow-slate-100 active:scale-95 cursor-pointer">
               {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Save to DB
             </button>
             <button onClick={handlePrint} disabled={!data.items.length} className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md shadow-slate-200 active:scale-95 cursor-pointer">
               <FileText className="w-4 h-4" /> Export/Print PDF
             </button>
             <button onClick={clearDraft} className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:text-black hover:border-black transition-all border border-slate-200 shadow-xs active:scale-95 cursor-pointer">
               <RotateCcw className="w-4 h-4" /> RESET ALL
             </button>
             <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all border border-slate-200 shadow-xs cursor-pointer">
               <SettingsIcon className="w-4 h-4" /> Options
             </button>
          </div>
        </header>

        {showSettings && (
          <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-md border border-slate-200 space-y-6 animate-in slide-in-from-top-4 duration-300 print-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-black" /> Predefined Master Options
              </h2>
              <button onClick={() => setShowSettings(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Prepared By Options</h3>
                {canManageSettings ? (
                  <div className="space-y-2">
                    <input 
                      type="text" 
                      value={newPreparedBy} 
                      onChange={e => setNewPreparedBy(e.target.value)} 
                      placeholder="Name..." 
                      className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 focus:border-black rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 text-slate-800 transition-all font-medium"
                    />
                    <input 
                      type="text" 
                      value={newPreparedByDesignation} 
                      onChange={e => setNewPreparedByDesignation(e.target.value)} 
                      placeholder="Designation..." 
                      className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 focus:border-black rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 text-slate-800 transition-all font-medium"
                    />
                    <button onClick={addExecutive} className="w-full py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-slate-100 cursor-pointer active:scale-[0.98]">Add Executive</button>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic font-semibold">Only administrators can add/remove master options.</p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  {dbExecutives.map(opt => (
                    <span key={opt.id} className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors group">
                      {opt.name} {opt.designation && <span className="opacity-60 text-[10px]">({opt.designation})</span>} 
                      {canManageSettings && <X className="w-3.5 h-3.5 cursor-pointer opacity-40 hover:opacity-100 hover:text-black transition-all" onClick={() => removeExecutive(opt.id)} />}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Plant Name Options</h3>
                {canManageSettings ? (
                  <div className="space-y-2">
                    <input 
                      type="text" 
                      value={newPlantName} 
                      onChange={e => setNewPlantName(e.target.value)} 
                      placeholder="Plant Name..." 
                      className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 focus:border-black rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 text-slate-800 transition-all font-medium"
                    />
                    <input 
                      type="text" 
                      value={newPlantLocation} 
                      onChange={e => setNewPlantLocation(e.target.value)} 
                      placeholder="Location..." 
                      className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 focus:border-black rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 text-slate-800 transition-all font-medium"
                    />
                    <button onClick={addPlant} className="w-full py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-slate-100 cursor-pointer active:scale-[0.98]">Add Plant</button>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic font-semibold">Only administrators can add/remove master options.</p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  {dbPlants.map(opt => (
                    <span key={opt.id} className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors group">
                      {opt.name} {opt.location && <span className="opacity-60 text-[10px]">({opt.location})</span>} 
                      {canManageSettings && <X className="w-3.5 h-3.5 cursor-pointer opacity-40 hover:opacity-100 hover:text-black transition-all" onClick={() => removePlant(opt.id)} />}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-8 print-hidden">
          <div className="col-span-12 lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5 relative">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Document Metadata</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Doc No.</label>
                  <button 
                    onClick={() => generateDocNo(true)}
                    className="text-[10px] font-bold text-slate-400 hover:text-black flex items-center gap-1 mb-0.5 transition-colors cursor-pointer"
                    title="Reset to latest chronological number"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> RESET
                  </button>
                </div>
                <input type="text" value={header.docNo} onChange={e => setHeader({...header, docNo: e.target.value})} className="w-full mt-1 px-4 py-2.5 bg-slate-50/50 border border-slate-200 focus:border-black rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 text-slate-800 font-bold transition-all" placeholder="C0124-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Prepared By</label>
                <select 
                  value={selectedExecutiveId || ''} 
                  onChange={e => {
                    const id = parseInt(e.target.value);
                    setSelectedExecutiveId(id || null);
                    const exec = dbExecutives.find(x => x.id === id);
                    if (exec) setHeader({...header, preparedBy: exec.name});
                  }} 
                  className="w-full mt-1 px-4 py-2.5 bg-slate-50/50 border border-slate-200 focus:border-black rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 text-slate-800 transition-all font-medium cursor-pointer"
                >
                  <option value="">Select Executive</option>
                  {dbExecutives.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plant</label>
                <select 
                  value={selectedPlantId || ''} 
                  onChange={e => {
                    const id = parseInt(e.target.value);
                    setSelectedPlantId(id || null);
                    const plant = dbPlants.find(x => x.id === id);
                    if (plant) setHeader({...header, plantName: plant.name});
                  }} 
                  className="w-full mt-1 px-4 py-2.5 bg-slate-50/50 border border-slate-200 focus:border-black rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 text-slate-800 transition-all font-medium cursor-pointer"
                >
                  <option value="">Select Plant</option>
                  {dbPlants.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Indent Date</label>
                <input 
                  type="date" 
                  value={header.indentDate} 
                  onChange={e => setHeader({...header, indentDate: e.target.value})} 
                  className="w-full mt-1 px-4 py-2.5 bg-slate-50/50 border border-slate-200 focus:border-black rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 text-slate-800 transition-all font-medium" 
                />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Special Extraction Instructions (Optional)</label>
                <textarea 
                  value={extractionPrompt} 
                  onChange={e => setExtractionPrompt(e.target.value)} 
                  className="w-full mt-1 px-4 py-2.5 bg-slate-50/50 border border-slate-200 focus:border-black rounded-xl text-sm min-h-[90px] focus:outline-none focus:ring-2 focus:ring-black/5 text-slate-800 transition-all font-medium" 
                  placeholder="e.g. 'The data is in one line', 'Ignore vendor X', 'Focus on specific columns'"
                />
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Extraction Source</h2>
            {canExtract ? (
              <>
                <div 
                  onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${isDragActive ? 'border-black bg-slate-50' : 'border-slate-200 hover:border-black hover:bg-slate-50/50 bg-slate-50/30'}`}
                >
                  <input {...getInputProps()} />
                  <Upload className={`w-10 h-10 mx-auto mb-3 transition-transform duration-300 ${isDragActive ? 'text-black scale-110' : 'text-slate-400 hover:scale-105'}`} />
                  <p className="text-sm text-slate-600 font-semibold">Drop PDF/Images anywhere or <span className="text-black underline">browse files</span></p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">Supports PDF, JPEG, JPG, PNG files</p>
                </div>
                
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {files.map((f, i) => (
                      <span key={i} className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-[10px] font-bold flex items-center gap-2 shadow-xs transition-colors hover:bg-slate-200">
                        {f.name} <Trash2 className="w-3 h-3 text-slate-400 hover:text-black cursor-pointer transition-colors" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} />
                      </span>
                    ))}
                  </div>
                )}

                <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Or paste quotation text content here..." className="w-full h-32 px-4 py-3 bg-slate-50/50 border border-slate-200 focus:border-black rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/5 text-slate-800 font-medium transition-all" />

                <div className="flex gap-3">
                  <div className="flex flex-col gap-2 flex-1">
                    <button onClick={handleExtract} disabled={isExtracting || (!inputText && !files.length)} className="w-full py-3.5 bg-black hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-100 hover:shadow-slate-200 cursor-pointer active:scale-[0.98]">
                      {isExtracting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} Extract Quotation Data
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <ShieldCheck className="w-12 h-12 text-slate-350 mx-auto mb-4" />
                <h3 className="text-md font-bold text-slate-800 uppercase tracking-tight">Access Restricted</h3>
                <p className="text-xs text-slate-500 mt-2">You do not have permission to use the AI Extraction tool.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center print-hidden">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Comparison Summary Grid</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
                <label className="text-[10px] font-bold uppercase text-slate-600 cursor-pointer select-none" htmlFor="multiplyByWeight">Multiply by Weight (WT)</label>
                <input 
                  id="multiplyByWeight"
                  type="checkbox" 
                  checked={data.multiplyByWeight || false} 
                  onChange={e => setData(prev => ({ ...prev, multiplyByWeight: e.target.checked }))} 
                  className="w-4.5 h-4.5 accent-black rounded-lg border-slate-300 cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-bold uppercase text-slate-600">Font Size: {fontSize}px</span>
                <input 
                  type="range" 
                  min="8" 
                  max="16" 
                  step="0.5"
                  value={fontSize} 
                  onChange={e => setFontSize(parseFloat(e.target.value))} 
                  className="w-32 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-black"
                />
              </div>
              {isExtracting && <span className="flex items-center gap-2 text-black animate-pulse text-xs font-bold"><Loader2 className="w-3 h-3 animate-spin" /> AI Analyzing...</span>}
            </div>
          </div>
          <div className="p-5">
            {isExtracting ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
                <div className="h-20 bg-slate-100 rounded-lg w-full"></div>
                <div className="h-20 bg-slate-100 rounded-lg w-full"></div>
              </div>
            ) : (
              <ComparisonTable data={data} setData={setData} header={header} setHeader={setHeader} tableRef={tableRef} fontSize={fontSize} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Builder;
