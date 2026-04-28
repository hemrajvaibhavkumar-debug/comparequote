import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, Table as TableIcon, FileOutput, Loader2, Plus, Trash2, Mail, Eye } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { extractQuotations } from './services/gemini';
import { ComparisonData, HeaderInfo } from './types';
import { ComparisonTable } from './components/ComparisonTable';
import * as Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

declare const google: any;

const Builder: React.FC = () => {
  // State with LocalStorage persistence (Auto-save draft)
  const [header, setHeader] = useState<HeaderInfo>(() => {
    const saved = localStorage.getItem('quote_draft_header');
    return saved ? JSON.parse(saved) : {
      docNo: '',
      preparedBy: '',
      date: new Date().toLocaleDateString(),
      indentDate: '',
      plantName: ''
    };
  });

  const [data, setData] = useState<ComparisonData>(() => {
    const saved = localStorage.getItem('quote_draft_data');
    return saved ? JSON.parse(saved) : { items: [], vendors: [] };
  });

  const [inputText, setInputText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [files, setFiles] = useState<{ name: string; mimeType: string; data: string }[]>([]);
  const [provider, setProvider] = useState<'gemini' | 'groq'>('groq');
  
  const tableRef = useRef<HTMLDivElement>(null);

  // Auto-save effect
  useEffect(() => {
    localStorage.setItem('quote_draft_header', JSON.stringify(header));
  }, [header]);

  useEffect(() => {
    localStorage.setItem('quote_draft_data', JSON.stringify(data));
  }, [data]);

  const clearDraft = () => {
    if (window.confirm("Are you sure you want to clear the current draft?")) {
      const freshHeader = { docNo: '', preparedBy: '', date: new Date().toLocaleDateString(), indentDate: '', plantName: '' };
      const freshData = { items: [], vendors: [] };
      setHeader(freshHeader);
      setData(freshData);
      setInputText('');
      setFiles([]);
      localStorage.removeItem('quote_draft_header');
      localStorage.removeItem('quote_draft_data');
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
        data: { header, data }
      };
      const res = await fetch('/api/comparisons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify(payload)
      });
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

  const onDrop = async (acceptedFiles: File[]) => {
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
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpeg', '.jpg', '.png'] },
    multiple: true
  });

  const handleExtract = async () => {
    setIsExtracting(true);
    try {
      const extracted = await extractQuotations(inputText, files, provider);
      if (extracted?.items) {
        extracted.items = extracted.items.map((item) => {
          const processedQuotes = item.vendorQuotes?.map((q: any) => {
            let nr = parseFloat(q.netRate) || 0;
            let mrp = parseFloat(q.mrp) || 0;
            const disc = parseFloat(q.discount) || 0;
            const qty = parseFloat(item.qty) || 0;

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
      }
      setData(extracted);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to extract quotations.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSyncGmail = () => {
    if (typeof google === 'undefined') {
       alert("Google Identity Services not loaded.");
       return;
    }
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      callback: async (response: any) => {
        if (response.access_token) {
          setIsExtracting(true);
          try {
            const res = await fetch('/api/sync-gmail', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ accessToken: response.access_token, query: 'has:attachment' })
            });
            const d = await res.json();
            if (d.success && d.parsedData) {
               setData(d.parsedData.data || d.parsedData);
               if (d.parsedData.header) setHeader(prev => ({...prev, ...d.parsedData.header}));
            } else {
               alert(d.message || d.error || "No relevant emails found.");
            }
          } catch (e) {
            alert("Error syncing with Gmail.");
          } finally {
            setIsExtracting(false);
          }
        }
      }
    });
    client.requestAccessToken();
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Comparison');

    worksheet.columns = [
      { header: 'SI NO', key: 'siNo', width: 10 },
      { header: 'DESCRIPTION', key: 'desc', width: 40 },
      { header: 'UOM', key: 'uom', width: 10 },
      { header: 'QTY', key: 'qty', width: 10 },
      { header: 'PREV RATE', key: 'prev', width: 15 },
    ];

    const vendors = data.vendors || [];
    vendors.forEach(v => {
      worksheet.columns = [...worksheet.columns, 
        { header: `${v} MAKE`, key: `${v}_make`, width: 15 },
        { header: `${v} RATE`, key: `${v}_rate`, width: 15 },
        { header: `${v} TOTAL`, key: `${v}_total`, width: 15 }
      ];
    });

    data.items.forEach((item, i) => {
      const row: any = {
        siNo: item.siNo || (i + 1),
        desc: item.description,
        uom: item.uom,
        qty: item.qty,
        prev: item.previousPrice?.rate || 0
      };
      vendors.forEach(v => {
        const q = item.vendorQuotes?.find(q => q.vendorName === v);
        row[`${v}_make`] = q?.make || '';
        row[`${v}_rate`] = q?.netRate || 0;
        row[`${v}_total`] = q?.totalAmount || 0;
      });
      worksheet.addRow(row);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Comparison_${header.docNo || 'export'}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
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
             <button onClick={exportExcel} disabled={!data.items.length} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-all shadow-lg">
               <FileOutput className="w-4 h-4" /> Excel
             </button>
             <button onClick={handlePrint} disabled={!data.items.length} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg">
               <FileText className="w-4 h-4" /> Export/Print PDF
             </button>
             <button onClick={clearDraft} className="flex items-center gap-2 px-4 py-2.5 border border-red-100 text-red-500 rounded-xl text-sm font-bold hover:bg-red-50 transition-all">
               <Trash2 className="w-4 h-4" /> Clear
             </button>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-8 print-hidden">
          <div className="col-span-12 lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Document Metadata</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Doc No.</label>
                <input type="text" value={header.docNo} onChange={e => setHeader({...header, docNo: e.target.value})} className="w-full mt-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="QT-2024-001" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Prepared By</label>
                <input type="text" value={header.preparedBy} onChange={e => setHeader({...header, preparedBy: e.target.value})} className="w-full mt-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Plant</label>
                <input type="text" value={header.plantName} onChange={e => setHeader({...header, plantName: e.target.value})} className="w-full mt-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Extraction Source</h2>
            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}>
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600 font-medium">Drop PDF/Images here</p>
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
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setProvider('gemini')} 
                    className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${provider === 'gemini' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Gemini (Vision)
                  </button>
                  <button 
                    onClick={() => setProvider('groq')} 
                    className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${provider === 'groq' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Groq (Llama-4)
                  </button>
                </div>
                <button onClick={handleExtract} disabled={isExtracting || (!inputText && !files.length)} className="w-full py-3.5 bg-slate-800 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-slate-900 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {isExtracting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} Extract Data
                </button>
              </div>
              <button onClick={handleSyncGmail} disabled={isExtracting} className="flex-1 h-[96px] bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2">
                <Mail className="w-5 h-5" /> Gmail Sync
              </button>
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
