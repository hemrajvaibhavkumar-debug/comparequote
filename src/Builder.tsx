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
    fetchMasters();
    generateDocNo();
    const savedFontSize = localStorage.getItem('quote_table_font_size');
    if (savedFontSize) setFontSize(parseInt(savedFontSize));
  }, []);

  useEffect(() => {
    localStorage.setItem('quote_table_font_size', fontSize.toString());
  }, [fontSize]);

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
      const extracted = await extractQuotations(inputText, files, extractionPrompt);
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
              mrp: Number(mrp.toFixed(2)),
              netRate: Number(nr.toFixed(2)),
              totalAmount: Number((nr * qty).toFixed(2))
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
    <div {...getRootProps()} className={`min-h-screen bg-white p-4 md:p-8 font-sans transition-colors relative ${isDragActive ? 'bg-white' : ''}`}>
      {isDragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm pointer-events-none border-4 border-black border-dashed m-4 rounded-3xl">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
            <Upload className="w-16 h-16 text-black animate-bounce" />
            <p className="text-xl font-bold text-black">Drop files anywhere to upload</p>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-black print-hidden">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center shadow-lg">
              <TableIcon className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-black">QuoteCompare</h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <button onClick={saveToNeon} disabled={isSaving || !data.items.length} className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-xl text-sm font-bold hover:bg-black/90 disabled:opacity-50 transition-all shadow-lg">
               {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Save to DB
             </button>
             <button onClick={handlePrint} disabled={!data.items.length} className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-xl text-sm font-bold hover:bg-black/90 disabled:opacity-50 transition-all shadow-lg">
               <FileText className="w-4 h-4" /> Export/Print PDF
             </button>
             <button onClick={clearDraft} className="flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-xl text-sm font-bold hover:bg-black/10 transition-all border border-black shadow-sm">
               <RotateCcw className="w-4 h-4" /> RESET ALL
             </button>
             <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-2 px-4 py-2.5 bg-white text-black rounded-xl text-sm font-bold hover:bg-black/10 transition-all border border-black">
               <SettingsIcon className="w-4 h-4" /> Settings
             </button>
          </div>
        </header>

        {showSettings && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-black space-y-6 animate-in slide-in-from-top-4 duration-300 print-hidden">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-black flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-black" /> Predefined Options
              </h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-black/10 rounded-lg">
                <X className="w-5 h-5 text-black" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-black uppercase">Prepared By Options</h3>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    value={newPreparedBy} 
                    onChange={e => setNewPreparedBy(e.target.value)} 
                    placeholder="Name..." 
                    className="w-full px-4 py-2 bg-white border border-black rounded-lg text-sm"
                  />
                  <input 
                    type="text" 
                    value={newPreparedByDesignation} 
                    onChange={e => setNewPreparedByDesignation(e.target.value)} 
                    placeholder="Designation..." 
                    className="w-full px-4 py-2 bg-white border border-black rounded-lg text-sm"
                  />
                  <button onClick={addExecutive} className="w-full py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-black/90">Add Executive</button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {dbExecutives.map(opt => (
                    <span key={opt.id} className="px-3 py-1 bg-black text-white rounded-lg text-xs font-medium flex items-center gap-2">
                      {opt.name} {opt.designation && `(${opt.designation})`} <X className="w-3 h-3 cursor-pointer hover:text-white/80" onClick={() => removeExecutive(opt.id)} />
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-black uppercase">Plant Name Options</h3>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    value={newPlantName} 
                    onChange={e => setNewPlantName(e.target.value)} 
                    placeholder="Plant Name..." 
                    className="w-full px-4 py-2 bg-white border border-black rounded-lg text-sm"
                  />
                  <input 
                    type="text" 
                    value={newPlantLocation} 
                    onChange={e => setNewPlantLocation(e.target.value)} 
                    placeholder="Location..." 
                    className="w-full px-4 py-2 bg-white border border-black rounded-lg text-sm"
                  />
                  <button onClick={addPlant} className="w-full py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-black/90">Add Plant</button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {dbPlants.map(opt => (
                    <span key={opt.id} className="px-3 py-1 bg-black text-white rounded-lg text-xs font-medium flex items-center gap-2">
                      {opt.name} {opt.location && `(${opt.location})`} <X className="w-3 h-3 cursor-pointer hover:text-white/80" onClick={() => removePlant(opt.id)} />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-8 print-hidden">
          <div className="col-span-12 lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-black space-y-5">
            <h2 className="text-sm font-bold text-black uppercase tracking-wider">Document Metadata</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-bold text-black uppercase">Doc No.</label>
                  <button 
                    onClick={() => generateDocNo(true)}
                    className="text-[10px] font-bold text-black hover:underline flex items-center gap-1 mb-0.5"
                    title="Reset to latest chronological number"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> RESET
                  </button>
                </div>
                <input type="text" value={header.docNo} onChange={e => setHeader({...header, docNo: e.target.value})} className="w-full mt-1 px-4 py-2 bg-white border border-black rounded-lg text-sm" placeholder="C0124-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-black uppercase">Prepared By</label>
                <select 
                  value={selectedExecutiveId || ''} 
                  onChange={e => {
                    const id = parseInt(e.target.value);
                    setSelectedExecutiveId(id || null);
                    const exec = dbExecutives.find(x => x.id === id);
                    if (exec) setHeader({...header, preparedBy: exec.name});
                  }} 
                  className="w-full mt-1 px-4 py-2 bg-white border border-black rounded-lg text-sm"
                >
                  <option value="">Select Executive</option>
                  {dbExecutives.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-black uppercase">Plant</label>
                <select 
                  value={selectedPlantId || ''} 
                  onChange={e => {
                    const id = parseInt(e.target.value);
                    setSelectedPlantId(id || null);
                    const plant = dbPlants.find(x => x.id === id);
                    if (plant) setHeader({...header, plantName: plant.name});
                  }} 
                  className="w-full mt-1 px-4 py-2 bg-white border border-black rounded-lg text-sm"
                >
                  <option value="">Select Plant</option>
                  {dbPlants.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-black uppercase">Date</label>
                <input 
                  type="date" 
                  value={header.date} 
                  onChange={e => setHeader({...header, date: e.target.value})} 
                  className="w-full mt-1 px-4 py-2 bg-white border border-black rounded-lg text-sm text-black" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-black uppercase">Indent Date</label>
                <input 
                  type="date" 
                  value={header.indentDate} 
                  onChange={e => setHeader({...header, indentDate: e.target.value})} 
                  className="w-full mt-1 px-4 py-2 bg-white border border-black rounded-lg text-sm text-black" 
                />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-bold text-black uppercase">Special Extraction Instructions (Optional)</label>
                <textarea 
                  value={extractionPrompt} 
                  onChange={e => setExtractionPrompt(e.target.value)} 
                  className="w-full mt-1 px-4 py-2 bg-white border border-black rounded-lg text-sm min-h-[80px] text-black" 
                  placeholder="e.g. 'The data is in one line', 'Ignore vendor X', 'Focus on specific columns'"
                />
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-black space-y-5">
            <h2 className="text-sm font-bold text-black uppercase tracking-wider">Extraction Source</h2>
            <div 
              onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${isDragActive ? 'border-black bg-white' : 'border-black bg-white'}`}
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 text-black mx-auto mb-2" />
              <p className="text-sm text-black font-medium">Drop PDF/Images anywhere or click to browse</p>
            </div>
            
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <span key={i} className="px-3 py-1 bg-black text-white rounded-full text-[10px] font-bold flex items-center gap-2">
                    {f.name} <Trash2 className="w-3 h-3 cursor-pointer" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} />
                  </span>
                ))}
              </div>
            )}

            <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Or paste quotation text..." className="w-full h-32 px-4 py-3 bg-white border border-black rounded-xl text-sm resize-none text-black" />

            <div className="flex gap-3">
              <div className="flex flex-col gap-2 flex-1">
                <button onClick={handleExtract} disabled={isExtracting || (!inputText && !files.length)} className="w-full py-3.5 bg-black text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-black/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {isExtracting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} Extract Data
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black shadow-sm overflow-hidden">
          <div className="p-5 border-b border-black flex justify-between items-center print-hidden">
            <h2 className="text-sm font-bold text-black uppercase tracking-wider">Comparison Table</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-black">Font Size: {fontSize}px</span>
                <input 
                  type="range" 
                  min="8" 
                  max="16" 
                  step="0.5"
                  value={fontSize} 
                  onChange={e => setFontSize(parseFloat(e.target.value))} 
                  className="w-32 h-1 bg-black rounded-lg appearance-none cursor-pointer accent-black"
                />
              </div>
              {isExtracting && <span className="flex items-center gap-2 text-black animate-pulse text-xs font-bold"><Loader2 className="w-3 h-3 animate-spin" /> AI Analyzing...</span>}
            </div>
          </div>
          <div className="p-5">
            {isExtracting ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-10 bg-black/5 rounded-lg w-full"></div>
                <div className="h-20 bg-black/5 rounded-lg w-full"></div>
                <div className="h-20 bg-black/5 rounded-lg w-full"></div>
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
