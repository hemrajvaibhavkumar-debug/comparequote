import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, Table as TableIcon, Loader2, Plus, Trash2, Eye, Settings as SettingsIcon, X, RotateCcw } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { extractQuotations } from './services/gemini';
import { ComparisonData, HeaderInfo } from './types';
import { ComparisonTable } from './components/ComparisonTable';
import * as Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

declare const google: any;

interface DBExecutive { id: number; name: string; designation?: string; }
interface DBPlant { id: number; name: string; location?: string; }

const Builder: React.FC = () => {
  // State with LocalStorage persistence (Auto-save draft)
  const [header, setHeader] = useState<HeaderInfo>(() => {
    const saved = localStorage.getItem('quote_draft_header');
    return saved ? JSON.parse(saved) : {
      docNo: '',
      preparedBy: '',
      date: new Date().toISOString().split('T')[0],
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
    return saved ? JSON.parse(saved) : { items: [], vendors: [] };
  });

  const generateDocNo = async (force = false) => {
    // Only generate if docNo is empty, unless forced
    if (header.docNo && !force) return;

    try {
      const res = await fetch('/api/comparisons/latest-year', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      
      if (res.status === 403) {
        localStorage.removeItem('admin_token');
        window.location.href = '/login';
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

  const [inputText, setInputText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [files, setFiles] = useState<{ name: string; mimeType: string; data: string }[]>([]);
  
  const tableRef = useRef<HTMLDivElement>(null);

  // Auto-save effect
  useEffect(() => {
    localStorage.setItem('quote_draft_header', JSON.stringify(header));
  }, [header]);

  useEffect(() => {
    localStorage.setItem('quote_draft_data', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    fetchMasters();
    generateDocNo();
  }, []);

  const fetchMasters = async () => {
    try {
      const res = await fetch('/api/masters', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });

      if (res.status === 403) {
        localStorage.removeItem('admin_token');
        window.location.href = '/login';
        return;
      }

      const d = await res.json();
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
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ name: newPreparedBy, designation: newPreparedByDesignation })
      });
      if (res.ok) {
        setNewPreparedBy('');
        setNewPreparedByDesignation('');
        fetchMasters();
      }
    } catch (e) { alert("Error adding executive"); }
  };

  const removeExecutive = async (id: number) => {
    if (!window.confirm("Delete this executive?")) return;
    try {
      const res = await fetch(`/api/executives/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (res.ok) fetchMasters();
    } catch (e) { alert("Error deleting executive"); }
  };

  const addPlant = async () => {
    if (!newPlantName.trim()) return;
    try {
      const res = await fetch('/api/plants', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ name: newPlantName, location: newPlantLocation })
      });
      if (res.ok) {
        setNewPlantName('');
        setNewPlantLocation('');
        fetchMasters();
      }
    } catch (e) { alert("Error adding plant"); }
  };

  const removePlant = async (id: number) => {
    if (!window.confirm("Delete this plant?")) return;
    try {
      const res = await fetch(`/api/plants/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (res.ok) fetchMasters();
    } catch (e) { alert("Error deleting plant"); }
  };

  const clearDraft = () => {
    if (window.confirm("Are you sure you want to clear the current draft?")) {
      const freshHeader = { docNo: '', preparedBy: '', date: new Date().toISOString().split('T')[0], indentDate: '', plantName: '' };
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
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 403) {
        localStorage.removeItem('admin_token');
        window.location.href = '/login';
        return;
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save.");
      }
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
      const existingItemDescriptions = data.items.map(item => item.description).filter(d => !!d);
      const extracted = await extractQuotations(inputText, files, existingItemDescriptions);
      if (extracted?.items) {
        extracted.items = extracted.items.map((item) => {
          const processedQuotes = item.vendorQuotes?.map((q: any) => {
            let nr = parseFloat(q.netRate) || 0;
            let mrp = parseFloat(q.mrp) || 0;
            const disc = parseFloat(q.discount) || 0;
            const qty = Number(item.qty) || 0;

            if (disc === 0) {
              // If no discount, sync MRP and NetRate
              if (nr > 0 && mrp === 0) mrp = nr;
              else if (mrp > 0 && nr === 0) nr = mrp;
            }

            return {
              ...q,
              mrp,
              netRate: nr,
              totalAmount: nr * qty
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
              ei => ei.description?.toLowerCase().trim() === newItem.description?.toLowerCase().trim()
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
    <div {...getRootProps()} className={`min-h-screen bg-slate-50 p-4 md:p-8 font-sans transition-colors relative ${isDragActive ? 'bg-indigo-50/50' : ''}`}>
      {isDragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-600/10 backdrop-blur-sm pointer-events-none border-4 border-indigo-600 border-dashed m-4 rounded-3xl">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
            <Upload className="w-16 h-16 text-indigo-600 animate-bounce" />
            <p className="text-xl font-bold text-slate-800">Drop files anywhere to upload</p>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print-hidden">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <TableIcon className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">QuoteCompare</h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <button onClick={saveToNeon} disabled={isSaving || !data.items.length} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg">
               {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Save to DB
             </button>
             <button onClick={handlePrint} disabled={!data.items.length} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg">
               <FileText className="w-4 h-4" /> Export/Print PDF
             </button>
             <button onClick={clearDraft} className="flex items-center gap-2 px-6 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all border border-red-200 shadow-sm">
               <RotateCcw className="w-4 h-4" /> RESET ALL
             </button>
             <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all">
               <SettingsIcon className="w-4 h-4" /> Settings
             </button>
          </div>
        </header>

        {showSettings && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 space-y-6 animate-in slide-in-from-top-4 duration-300 print-hidden">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-indigo-600" /> Predefined Options
              </h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-600 uppercase">Prepared By Options</h3>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    value={newPreparedBy} 
                    onChange={e => setNewPreparedBy(e.target.value)} 
                    placeholder="Name..." 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  />
                  <input 
                    type="text" 
                    value={newPreparedByDesignation} 
                    onChange={e => setNewPreparedByDesignation(e.target.value)} 
                    placeholder="Designation..." 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  />
                  <button onClick={addExecutive} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Add Executive</button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {dbExecutives.map(opt => (
                    <span key={opt.id} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-2">
                      {opt.name} {opt.designation && `(${opt.designation})`} <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => removeExecutive(opt.id)} />
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-600 uppercase">Plant Name Options</h3>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    value={newPlantName} 
                    onChange={e => setNewPlantName(e.target.value)} 
                    placeholder="Plant Name..." 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  />
                  <input 
                    type="text" 
                    value={newPlantLocation} 
                    onChange={e => setNewPlantLocation(e.target.value)} 
                    placeholder="Location..." 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  />
                  <button onClick={addPlant} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Add Plant</button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {dbPlants.map(opt => (
                    <span key={opt.id} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-2">
                      {opt.name} {opt.location && `(${opt.location})`} <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => removePlant(opt.id)} />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-8 print-hidden">
          <div className="col-span-12 lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Document Metadata</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Doc No.</label>
                  <button 
                    onClick={() => generateDocNo(true)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mb-0.5"
                    title="Reset to latest chronological number"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> RESET
                  </button>
                </div>
                <input type="text" value={header.docNo} onChange={e => setHeader({...header, docNo: e.target.value})} className="w-full mt-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="C0124-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Prepared By</label>
                <select 
                  value={selectedExecutiveId || ''} 
                  onChange={e => {
                    const id = parseInt(e.target.value);
                    setSelectedExecutiveId(id || null);
                    const exec = dbExecutives.find(x => x.id === id);
                    if (exec) setHeader({...header, preparedBy: exec.name});
                  }} 
                  className="w-full mt-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">Select Executive</option>
                  {dbExecutives.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Plant</label>
                <select 
                  value={selectedPlantId || ''} 
                  onChange={e => {
                    const id = parseInt(e.target.value);
                    setSelectedPlantId(id || null);
                    const plant = dbPlants.find(x => x.id === id);
                    if (plant) setHeader({...header, plantName: plant.name});
                  }} 
                  className="w-full mt-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">Select Plant</option>
                  {dbPlants.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                <input 
                  type="date" 
                  value={header.date} 
                  onChange={e => setHeader({...header, date: e.target.value})} 
                  className="w-full mt-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Indent Date</label>
                <input 
                  type="date" 
                  value={header.indentDate} 
                  onChange={e => setHeader({...header, indentDate: e.target.value})} 
                  className="w-full mt-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" 
                />
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Extraction Source</h2>
            <div 
              onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600 font-medium">Drop PDF/Images anywhere or click to browse</p>
            </div>
            
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-bold flex items-center gap-2">
                    {f.name} <Trash2 className="w-3 h-3 cursor-pointer" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} />
                  </span>
                ))}
              </div>
            )}

            <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Or paste quotation text..." className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none" />

            <div className="flex gap-3">
              <div className="flex flex-col gap-2 flex-1">
                <button onClick={handleExtract} disabled={isExtracting || (!inputText && !files.length)} className="w-full py-3.5 bg-slate-800 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-slate-900 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {isExtracting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} Extract Data
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Comparison Table</h2>
            {isExtracting && <span className="flex items-center gap-2 text-indigo-600 animate-pulse text-xs font-bold"><Loader2 className="w-3 h-3 animate-spin" /> AI Analyzing...</span>}
          </div>
          <div className="p-5">
            {isExtracting ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
                <div className="h-20 bg-slate-50 rounded-lg w-full"></div>
                <div className="h-20 bg-slate-50 rounded-lg w-full"></div>
              </div>
            ) : (
              <ComparisonTable data={data} setData={setData} header={header} setHeader={setHeader} tableRef={tableRef} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Builder;
