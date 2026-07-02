import React, { useState, useEffect } from 'react';
import { Mail, Plus, Trash2, Send, Users, ShieldCheck, ClipboardList, Check, AlertCircle, RefreshCw, FileSpreadsheet, Download } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { useApiCache } from './context/ApiCacheContext';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface InquiryItem {
  id: string;
  description: string;
  qty: string | number;
  uom: string;
  make: string;
}

interface Vendor {
  name: string;
  address?: string;
  state?: string;
  gstin?: string;
  mobile_no?: string;
  email?: string;
}

const EMPLOYEES = [
  "Debasish Samanta",
  "Rakesh Pal",
  "Souritra Ghoshal",
  "Rupak Mukherjee",
  "Soumen Karmakar",
  "Gourav Indra"
];

const UOM_OPTIONS = [
  "Nos",
  "Sets",
  "Kgs",
  "Mtrs",
  "Ltrs",
  "Box",
  "Pkt",
  "Bag"
];

const AutoInquiryMailer: React.FC = () => {
  const { token } = useAuth();
  const { fetchVendors } = useApiCache();

  // State
  const [employeeName, setEmployeeName] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorName, setSelectedVendorName] = useState('');
  const [items, setItems] = useState<InquiryItem[]>([
    { id: '1', description: '', qty: '', uom: 'Nos', make: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [fetchingVendors, setFetchingVendors] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [company, setCompany] = useState('hemraj_rice');
  const [plant, setPlant] = useState('');

  const handleCompanyChange = (val: string) => {
    setCompany(val);
    if (val === 'radhashyam') {
      setPlant('RSIPL');
    } else {
      setPlant('');
    }
  };

  // Load vendors
  useEffect(() => {
    const loadVendors = async () => {
      try {
        setFetchingVendors(true);
        const data = await fetchVendors();
        setVendors(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch vendors:", err);
      } finally {
        setFetchingVendors(false);
      }
    };
    loadVendors();
  }, [fetchVendors]);

  // Handlers for Items Table
  const handleAddItem = () => {
    const newId = (Math.max(...items.map(item => parseInt(item.id) || 0), 0) + 1).toString();
    setItems(prev => [...prev, { id: newId, description: '', qty: '', uom: 'Nos', make: '' }]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) {
      setItems([{ id: '1', description: '', qty: '', uom: 'Nos', make: '' }]);
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof InquiryItem, value: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset the form?")) {
      setEmployeeName('');
      setSelectedVendorName('');
      setCompany('hemraj_rice');
      setPlant('');
      setItems([{ id: '1', description: '', qty: '', uom: 'Nos', make: '' }]);
      setStatusMessage(null);
    }
  };

  // Helper function to build the excel sheet following the exact format of the mockup
  const generateExcelWorkbook = (vendorName: string, vendorAddress: string, itemsList: InquiryItem[]) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Quotation Inquiry');

    // Column widths matching layout
    worksheet.columns = [
      { key: 'slNo', width: 10 },
      { key: 'itemName', width: 45 },
      { key: 'uom', width: 12 },
      { key: 'qty', width: 12 },
      { key: 'make', width: 18 },
      { key: 'mrp', width: 15 },
      { key: 'discount', width: 15 },
      { key: 'netRate', width: 15 },
      { key: 'amount', width: 15 },
      { key: 'remarks', width: 40 }
    ];

    // Helper to style cells
    const styleCell = (
      cell: any,
      bgColorHex: string,
      bold: boolean,
      fontColorHex = '000000',
      alignHorizontal = 'left',
      isItalic = false,
      fontSize = 10
    ) => {
      cell.font = {
        name: 'Calibri',
        size: fontSize,
        bold,
        italic: isItalic,
        color: { argb: 'FF' + fontColorHex.toUpperCase() }
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF' + bgColorHex.toUpperCase() }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: alignHorizontal,
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF9E9E9E' } },
        left: { style: 'thin', color: { argb: 'FF9E9E9E' } },
        bottom: { style: 'thin', color: { argb: 'FF9E9E9E' } },
        right: { style: 'thin', color: { argb: 'FF9E9E9E' } }
      };
    };

    // Helper to style merged ranges
    const applyStyleToRange = (
      ws: ExcelJS.Worksheet,
      rangeStr: string,
      bgColorHex: string,
      bold: boolean,
      fontColorHex = '000000',
      alignHorizontal = 'left',
      isItalic = false,
      fontSize = 10
    ) => {
      ws.mergeCells(rangeStr);
      const [start, end] = rangeStr.split(':');
      const startCol = ws.getCell(start).col;
      const startRow = ws.getCell(start).row;
      const endCol = ws.getCell(end).col;
      const endRow = ws.getCell(end).row;

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const cell = ws.getCell(r, c);
          styleCell(cell, bgColorHex, bold, fontColorHex, alignHorizontal, isItalic, fontSize);
        }
      }
    };

    // Row 1: ADDRESS
    worksheet.getRow(1).height = 42;
    styleCell(worksheet.getCell('A1'), '8DB4E2', true, '000000', 'left', false, 10);
    worksheet.getCell('A1').value = 'ADDRESS :';
    const fullAddress = (vendorName || '') + (vendorAddress ? '\n' + vendorAddress : '');
    applyStyleToRange(worksheet, 'B1:J1', 'C6E0B4', true, '000000', 'left', false, 10);
    worksheet.getCell('B1').value = fullAddress;

    // Row 2: TECHNICAL DISCUSSION CONTACT
    worksheet.getRow(2).height = 25;
    styleCell(worksheet.getCell('A2'), '8DB4E2', true, '000000', 'left', false, 9);
    worksheet.getCell('A2').value = 'CONTACT PERSON NAME & NUMBER FOR TECHNICAL DISCUSSION';
    applyStyleToRange(worksheet, 'B2:J2', 'C6E0B4', false, '000000', 'left', false, 10);
    worksheet.getCell('B2').value = '';

    // Row 3: COMMERCIAL DISCUSSION CONTACT
    worksheet.getRow(3).height = 25;
    styleCell(worksheet.getCell('A3'), '8DB4E2', true, '000000', 'left', false, 9);
    worksheet.getCell('A3').value = 'CONTACT PERSON NAME & NUMBER FOR COMMERCIAL DISCUSSION';
    applyStyleToRange(worksheet, 'B3:J3', 'C6E0B4', false, '000000', 'left', false, 10);
    worksheet.getCell('B3').value = '';

    // Row 4: DATE
    worksheet.getRow(4).height = 25;
    styleCell(worksheet.getCell('A4'), '8DB4E2', true, '000000', 'left', false, 10);
    worksheet.getCell('A4').value = 'DATE:';
    const todayStr = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
    applyStyleToRange(worksheet, 'B4:J4', 'C6E0B4', true, '000000', 'left', false, 10);
    worksheet.getCell('B4').value = todayStr;

    // Row 5 & 6: Table Headers
    worksheet.getRow(5).height = 28;
    worksheet.getRow(6).height = 25;

    applyStyleToRange(worksheet, 'A5:A6', 'FBD5B5', true, 'C00000', 'center', false, 10);
    worksheet.getCell('A5').value = 'SL NO';

    applyStyleToRange(worksheet, 'B5:B6', 'FBD5B5', true, 'C00000', 'center', false, 10);
    worksheet.getCell('B5').value = 'ITEM NAME';

    applyStyleToRange(worksheet, 'C5:C6', 'FBD5B5', true, 'C00000', 'center', false, 10);
    worksheet.getCell('C5').value = 'UOM';

    applyStyleToRange(worksheet, 'D5:D6', 'FBD5B5', true, 'C00000', 'center', false, 10);
    worksheet.getCell('D5').value = 'QTY';

    applyStyleToRange(worksheet, 'E5:E6', 'FBD5B5', true, 'C00000', 'center', false, 10);
    worksheet.getCell('E5').value = 'MAKE';

    applyStyleToRange(worksheet, 'F5:I5', 'B4C6E7', true, 'FF0000', 'center', false, 10);
    worksheet.getCell('F5').value = 'PLEASE WRITE YOUR COMPANY NAME HERE';

    styleCell(worksheet.getCell('F6'), 'B4C6E7', true, '000000', 'center', false, 10);
    worksheet.getCell('F6').value = 'MRP/EACH';

    styleCell(worksheet.getCell('G6'), 'B4C6E7', true, '000000', 'center', false, 10);
    worksheet.getCell('G6').value = 'DISCOUNT';

    styleCell(worksheet.getCell('H6'), 'B4C6E7', true, '000000', 'center', false, 10);
    worksheet.getCell('H6').value = 'NET RATE';

    styleCell(worksheet.getCell('I6'), 'B4C6E7', true, '000000', 'center', false, 10);
    worksheet.getCell('I6').value = 'AMOUNT';

    applyStyleToRange(worksheet, 'J5:J6', 'B4C6E7', true, '002060', 'center', false, 8);
    worksheet.getCell('J5').value = 'ANY REMARKS IF YOUR QUOTED ITEM IS NOT EXACTLY MATCHING OUR REQUIRE ITEM';

    // Row 7: Solid yellow/orange separator
    worksheet.getRow(7).height = 18;
    for (let c = 1; c <= 10; c++) {
      styleCell(worksheet.getCell(7, c), 'FFC000', false, '000000', 'center');
    }

    // Row 8 onwards: Items
    let currentRow = 8;
    itemsList.forEach((item, index) => {
      worksheet.getRow(currentRow).height = 24;
      
      worksheet.getCell(`A${currentRow}`).value = index + 1;
      worksheet.getCell(`B${currentRow}`).value = item.description;
      worksheet.getCell(`C${currentRow}`).value = item.uom;
      worksheet.getCell(`D${currentRow}`).value = parseFloat(item.qty.toString()) || 0;
      worksheet.getCell(`E${currentRow}`).value = item.make || '';

      styleCell(worksheet.getCell(`A${currentRow}`), 'FFFFFF', false, '000000', 'center');
      styleCell(worksheet.getCell(`B${currentRow}`), 'FFFFFF', false, '000000', 'left');
      styleCell(worksheet.getCell(`C${currentRow}`), 'FFFFFF', false, '000000', 'center');
      styleCell(worksheet.getCell(`D${currentRow}`), 'FFFFFF', false, '000000', 'center');
      styleCell(worksheet.getCell(`E${currentRow}`), 'FFFFFF', false, '000000', 'left');
      
      // Blank columns for vendor input
      styleCell(worksheet.getCell(`F${currentRow}`), 'FFFFFF', false, '000000', 'right');
      styleCell(worksheet.getCell(`G${currentRow}`), 'FFFFFF', false, '000000', 'right');
      styleCell(worksheet.getCell(`H${currentRow}`), 'FFFFFF', false, '000000', 'right');
      styleCell(worksheet.getCell(`I${currentRow}`), 'FFFFFF', false, '000000', 'right');
      styleCell(worksheet.getCell(`J${currentRow}`), 'FFFFFF', false, '000000', 'left');
      
      currentRow++;
    });

    // White spacer row
    worksheet.getRow(currentRow).height = 18;
    for (let c = 1; c <= 10; c++) {
      styleCell(worksheet.getCell(currentRow, c), 'FFFFFF', false, '000000', 'center');
    }
    currentRow++;

    // Commercial Terms Section label inputs
    const TERMS = [
      "COMMERCIAL TERMS :",
      "TAX :",
      "FREIGHT :",
      "PACKING & FORWARDING :",
      "PAYMENT :",
      "DELIVERY PERIOD :",
      "DELIVERY FREE UPTO :",
      "WARRANTY :",
      "ANY SPECIAL REMARKS YOU WANT TO MENTION :"
    ];

    TERMS.forEach((term, index) => {
      worksheet.getRow(currentRow).height = 24;

      const cellA = worksheet.getCell(`A${currentRow}`);
      cellA.value = index + 1;
      styleCell(cellA, '8DB4E2', true, '000000', 'center');

      const cellB = worksheet.getCell(`B${currentRow}`);
      cellB.value = term;
      styleCell(cellB, '8DB4E2', true, '000000', 'left');

      applyStyleToRange(worksheet, `C${currentRow}:J${currentRow}`, 'C6E0B4', false, '000000', 'left');

      currentRow++;
    });

    return workbook;
  };

  // Download Excel File Trigger
  const handleDownloadExcel = async () => {
    if (!selectedVendorName) {
      alert("Please select a vendor first to generate the inquiry Excel sheet.");
      return;
    }
    
    const invalidItems = items.filter(item => !item.description.trim() || !item.qty || parseFloat(item.qty.toString()) <= 0);
    if (invalidItems.length > 0) {
      alert("Please make sure all items have a description and a valid quantity before downloading the Excel.");
      return;
    }

    const selectedVendor = vendors.find(v => v.name === selectedVendorName);
    const vendorAddress = selectedVendor?.address || '';
    
    try {
      const workbook = generateExcelWorkbook(selectedVendorName, vendorAddress, items);
      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `RFQ_Inquiry_${selectedVendorName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(new Blob([buffer]), fileName);
    } catch (err) {
      console.error("Failed to generate Excel:", err);
      alert("An error occurred while exporting Excel.");
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    // Validation
    if (!employeeName) {
      setStatusMessage({ type: 'error', text: 'Please select an Employee Name.' });
      return;
    }
    if (!selectedVendorName) {
      setStatusMessage({ type: 'error', text: 'Please select a Vendor.' });
      return;
    }

    const invalidItems = items.filter(item => !item.description.trim() || !item.qty || parseFloat(item.qty.toString()) <= 0);
    if (invalidItems.length > 0) {
      setStatusMessage({ type: 'error', text: 'Please make sure all items have a description and a valid quantity.' });
      return;
    }

    const selectedVendor = vendors.find(v => v.name === selectedVendorName);
    const vendorAddress = selectedVendor?.address || '';

    setLoading(true);
    try {
      // 1. Generate Formatted Excel Base64
      let excelBase64 = '';
      const fileName = `RFQ_Inquiry_${selectedVendorName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

      try {
        const workbook = generateExcelWorkbook(selectedVendorName, vendorAddress, items);
        const buffer = await workbook.xlsx.writeBuffer();
        
        // Chunked binary to base64 conversion
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i += 1024) {
          const chunk = bytes.subarray(i, Math.min(i + 1024, len));
          binary += String.fromCharCode.apply(null, chunk as any);
        }
        excelBase64 = window.btoa(binary);
      } catch (excelErr) {
        console.error("Failed to generate excel attachment:", excelErr);
      }

      // 2. Send request to proxy backend
      const res = await fetch('/api/inquiry/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          employeeName,
          vendor: selectedVendor,
          company,
          plant: plant || undefined,
          items: items.map(({ description, qty, uom, make }) => ({
            description,
            qty: parseFloat(qty.toString()),
            uom,
            make: make.trim() || undefined
          })),
          excelBase64,
          fileName
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Quotation inquiry mailer sent successfully via n8n with attached formatted Excel!' });
        // Clear items after success
        setItems([{ id: '1', description: '', qty: '', uom: 'Nos', make: '' }]);
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to send inquiry mailer.' });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Network connection error. Failed to send.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-20 relative overflow-hidden min-h-screen bg-slate-50/50 dark:bg-slate-950">
      {/* Ambient background glows */}
      <div className="ambient-glow ambient-indigo -top-40 -right-40" />
      <div className="ambient-glow ambient-blue -bottom-40 -left-40" />

      {/* Header */}
      <div className="glass-navbar relative z-20 print-hidden border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="max-w-6xl mx-auto px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-pink-600 rounded-2xl shadow-lg shadow-pink-600/20 text-white">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 font-sans tracking-tight uppercase">Auto Inquiry Mailer</h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Quotation Requests & Automated RFQs</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownloadExcel}
                disabled={!selectedVendorName || items.some(item => !item.description.trim() || !item.qty)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer disabled:cursor-not-allowed shadow-md shadow-emerald-600/10"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Download RFQ Excel
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer"
              >
                Reset Form
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto py-8 px-8 relative z-10">
        <form onSubmit={handleSend} className="space-y-8">
          
          {/* Metadata Section */}
          <div className="glass-card p-6 rounded-[2rem] shadow-sm border border-slate-200/80 dark:border-slate-800">
            <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 text-left">
              <Users className="w-4 h-4 text-pink-500" /> Inquiry Parameters
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Employee name selector */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Employee Name</label>
                <select
                  value={employeeName}
                  onChange={e => setEmployeeName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all duration-200 cursor-pointer"
                  required
                >
                  <option value="">-- Select Employee --</option>
                  {EMPLOYEES.map(emp => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
              </div>

              {/* Vendor Selector */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Target Vendor</label>
                <select
                  value={selectedVendorName}
                  onChange={e => setSelectedVendorName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all duration-200 cursor-pointer"
                  required
                  disabled={fetchingVendors}
                >
                  {fetchingVendors ? (
                    <option value="">Loading Vendors...</option>
                  ) : (
                    <>
                      <option value="">-- Select Vendor --</option>
                      {vendors.map(v => (
                        <option key={v.name} value={v.name}>{v.name}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Company Selector */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Company</label>
                <select
                  value={company}
                  onChange={e => handleCompanyChange(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all duration-200 cursor-pointer"
                  required
                >
                  <option value="hemraj_rice">Hemraj Rice Mill</option>
                  <option value="hemraj_ind">Hemraj Industries</option>
                  <option value="radhashyam">Radhashyam Industries</option>
                </select>
              </div>

              {/* Plant Selector */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Plant</label>
                <select
                  value={plant}
                  onChange={e => setPlant(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all duration-200 cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 disabled:cursor-not-allowed"
                  disabled={company !== 'radhashyam'}
                  required={company === 'radhashyam'}
                >
                  {company === 'radhashyam' ? (
                    <>
                      <option value="RSIPL">RSIPL</option>
                      <option value="Sunagrow">Sunagrow</option>
                      <option value="Ricefield">Ricefield</option>
                    </>
                  ) : (
                    <option value="">N/A (Not Radhashyam)</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="glass-card p-6 rounded-[2rem] shadow-sm border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 text-left">
                <ClipboardList className="w-4 h-4 text-pink-500" /> Inquiry Items list
              </h2>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 bg-pink-600 hover:bg-pink-700 text-white px-3 py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-widest transition-all duration-200 shadow-md shadow-pink-600/10 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            {/* Table / Grid for items */}
            <div className="overflow-x-auto border border-slate-250/60 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/40">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 w-12 text-center">#</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Item Description</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 w-24">Qty</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 w-28">UOM</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 w-44">Make (Optional)</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 w-16 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-950/30 transition-colors">
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          value={item.description}
                          onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}
                          rows={1}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all duration-200 resize-none min-h-[36px]"
                          placeholder="e.g. MS Pipe 3 inch class C"
                          required
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.qty}
                          onChange={e => handleUpdateItem(item.id, 'qty', e.target.value)}
                          min="0.001"
                          step="any"
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all duration-200"
                          placeholder="0"
                          required
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={item.uom}
                          onChange={e => handleUpdateItem(item.id, 'uom', e.target.value)}
                          className="w-full px-2 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all duration-200 cursor-pointer"
                        >
                          {UOM_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.make}
                          onChange={e => handleUpdateItem(item.id, 'make', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all duration-200"
                          placeholder="Tata, Jindal, etc."
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all duration-200 cursor-pointer"
                          title="Delete Row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3 shadow-inner ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-400'
            }`}>
              {statusMessage.type === 'success' ? (
                <Check className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <div className="text-xs font-bold uppercase tracking-wide text-left">{statusMessage.text}</div>
            </div>
          )}

          {/* Action Trigger */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || fetchingVendors}
              className="flex items-center justify-center gap-2 px-8 py-3.5 bg-pink-600 hover:bg-pink-700 disabled:bg-slate-350 dark:disabled:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-200 hover:-translate-y-0.5 transform shadow-lg shadow-pink-600/10 cursor-pointer disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Sending to n8n...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Send Quotation Inquiry
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AutoInquiryMailer;
