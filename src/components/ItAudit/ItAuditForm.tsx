import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ItAuditSubmission, ItAuditColumn, ItAuditSheet } from '../../types';
import { 
  ClipboardList, 
  History, 
  Plus, 
  Trash2, 
  Download, 
  Search, 
  Loader2, 
  User, 
  Layers, 
  Briefcase, 
  FileSpreadsheet, 
  Clock, 
  ExternalLink,
  X
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const DEPARTMENTS = [
  'Purchase',
  'Sales',
  'Finance',
  'Accounts',
  'HR',
  'Inventory',
  'Production',
  'Logistics',
  'Other'
];

const FREQUENCIES = [
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Occasionally', label: 'Occasionally' }
];

const ROLES = [
  'Create Data',
  'View Data',
  'Edit Data',
  'Delete Data',
  'Approve Data'
];

const TIME_SPENT_OPTIONS = [
  'Less than 30 mins',
  '30 mins – 1 hour',
  '1–3 hours',
  'More than 3 hours'
];

const CRUD_OPTIONS = [
  { key: 'Create', label: 'Create' },
  { key: 'View', label: 'View' },
  { key: 'Edit', label: 'Edit' },
  { key: 'Delete', label: 'Delete' },
  { key: 'Approve', label: 'Approve' }
];

const ItAuditForm: React.FC = () => {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  
  const isAdmin = user?.role === 'SUPERADMIN';
  
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [submissions, setSubmissions] = useState<ItAuditSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Global Form State
  const [employeeName, setEmployeeName] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');

  // Sheet-wise State
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [sheets, setSheets] = useState<ItAuditSheet[]>([
    {
      sheet_name: '',
      google_sheet_link: '',
      purpose: '',
      frequency: '',
      role: [],
      process_supported: '',
      time_spent: '',
      columns: [{ columnName: '', crudActions: [], notes: '' }]
    }
  ]);

  useEffect(() => {
    if (activeTab === 'history' && isAdmin) {
      fetchSubmissions();
    }
  }, [activeTab, isAdmin]);

  const fetchSubmissions = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch('/api/it-audits', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
      } else {
        showToast("Failed to fetch past submissions", "error");
      }
    } catch (err) {
      showToast("Error loading history", "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Sheet Management
  const addSheet = () => {
    setSheets(prev => [
      ...prev,
      {
        sheet_name: '',
        google_sheet_link: '',
        purpose: '',
        frequency: '',
        role: [],
        process_supported: '',
        time_spent: '',
        columns: [{ columnName: '', crudActions: [], notes: '' }]
      }
    ]);
    setSelectedSheetIndex(sheets.length);
  };

  const removeSheet = (index: number) => {
    if (sheets.length === 1) return;
    setSheets(prev => prev.filter((_, idx) => idx !== index));
    if (selectedSheetIndex >= index && selectedSheetIndex > 0) {
      setSelectedSheetIndex(selectedSheetIndex - 1);
    }
  };

  const updateSheetValue = (key: keyof ItAuditSheet, value: any) => {
    setSheets(prev => {
      const updated = [...prev];
      updated[selectedSheetIndex] = { ...updated[selectedSheetIndex], [key]: value };
      return updated;
    });
  };

  const handleRoleToggle = (role: string) => {
    const currentRoles = sheets[selectedSheetIndex].role || [];
    const nextRoles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    updateSheetValue('role', nextRoles);
  };

  // Columns Mapping Inside Active Sheet
  const addColumnRow = () => {
    setSheets(prev => {
      const updated = [...prev];
      const sheet = updated[selectedSheetIndex];
      sheet.columns = [...sheet.columns, { columnName: '', crudActions: [], notes: '' }];
      return updated;
    });
  };

  const removeColumnRow = (colIndex: number) => {
    setSheets(prev => {
      const updated = [...prev];
      const sheet = updated[selectedSheetIndex];
      if (sheet.columns.length === 1) {
        sheet.columns = [{ columnName: '', crudActions: [], notes: '' }];
      } else {
        sheet.columns = sheet.columns.filter((_, idx) => idx !== colIndex);
      }
      return updated;
    });
  };

  const updateColumnValue = (colIndex: number, key: keyof ItAuditColumn, value: any) => {
    setSheets(prev => {
      const updated = [...prev];
      const sheet = updated[selectedSheetIndex];
      const updatedCols = [...sheet.columns];
      updatedCols[colIndex] = { ...updatedCols[colIndex], [key]: value };
      sheet.columns = updatedCols;
      return updated;
    });
  };

  const resetForm = () => {
    setEmployeeName('');
    setDepartment('');
    setDesignation('');
    setSelectedSheetIndex(0);
    setSheets([
      {
        sheet_name: '',
        google_sheet_link: '',
        purpose: '',
        frequency: '',
        role: [],
        process_supported: '',
        time_spent: '',
        columns: [{ columnName: '', crudActions: [], notes: '' }]
      }
    ]);
  };

  const validateForm = (): boolean => {
    if (!employeeName.trim()) {
      showToast("Please enter Employee Name", "error");
      return false;
    }
    if (!department) {
      showToast("Please select your Department", "error");
      return false;
    }
    if (!designation.trim()) {
      showToast("Please enter Designation", "error");
      return false;
    }
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const sheetNum = i + 1;
      if (!sheet.sheet_name.trim()) {
        showToast(`Please enter File Name for Sheet #${sheetNum}`, "error");
        setSelectedSheetIndex(i);
        return false;
      }
      if (!sheet.google_sheet_link.trim()) {
        showToast(`Please enter Google Sheet Link for Sheet #${sheetNum}`, "error");
        setSelectedSheetIndex(i);
        return false;
      }
      if (!sheet.purpose.trim()) {
        showToast(`Please explain Purpose for Sheet #${sheetNum}`, "error");
        setSelectedSheetIndex(i);
        return false;
      }
      if (!sheet.frequency) {
        showToast(`Please select Usage Frequency for Sheet #${sheetNum}`, "error");
        setSelectedSheetIndex(i);
        return false;
      }
      if (sheet.role.length === 0) {
        showToast(`Please select your role for Sheet #${sheetNum}`, "error");
        setSelectedSheetIndex(i);
        return false;
      }
      if (!sheet.process_supported.trim()) {
        showToast(`Please enter Process Supported for Sheet #${sheetNum}`, "error");
        setSelectedSheetIndex(i);
        return false;
      }
      if (!sheet.time_spent) {
        showToast(`Please select Time Spent for Sheet #${sheetNum}`, "error");
        setSelectedSheetIndex(i);
        return false;
      }
      // Filter columns to ensure at least one columnName is filled
      const validCols = sheet.columns.filter(c => c.columnName.trim());
      if (validCols.length === 0) {
        showToast(`Please add at least one Column Name for Sheet #${sheetNum}`, "error");
        setSelectedSheetIndex(i);
        return false;
      }
    }
    return true;
  };

  const handleSaveForm = async () => {
    if (!validateForm()) return;

    // Filter out blank columns inside each sheet
    const activeSheets = sheets.map(sheet => ({
      ...sheet,
      columns: sheet.columns.filter(c => c.columnName.trim())
    }));

    const payload: ItAuditSubmission = {
      employee_name: employeeName.trim(),
      department,
      designation: designation.trim(),
      sheets: activeSheets
    };

    try {
      setLoading(true);
      const res = await fetch('/api/it-audits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast("IT Audit Form saved successfully!", "success");
        resetForm();
        if (isAdmin) {
          setActiveTab('history');
        }
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to save IT Audit", "error");
      }
    } catch (err) {
      showToast("Error saving audit data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this IT audit entry?")) return;

    try {
      const res = await fetch(`/api/it-audits/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        showToast("Entry deleted successfully");
        fetchSubmissions();
      } else {
        showToast("Failed to delete entry", "error");
      }
    } catch (err) {
      showToast("Error deleting audit entry", "error");
    }
  };

  // Beautiful Excel Export Generator supporting multi-sheets
  const exportToExcel = async (data: ItAuditSubmission) => {
    try {
      const workbook = new ExcelJS.Workbook();
      
      const ORANGE_HEX = 'FFF97316'; // Tailwind Orange-500
      const LIGHT_ORANGE_HEX = 'FFFFEDD5'; // Tailwind Orange-100
      const LIGHT_GRAY_HEX = 'FFF1F5F9'; // Tailwind Slate-100

      // Helper for headers
      const createSectionHeader = (ws: ExcelJS.Worksheet, rowNum: number, title: string) => {
        ws.mergeCells(`A${rowNum}:C${rowNum}`);
        const cell = ws.getCell(`A${rowNum}`);
        cell.value = title.toUpperCase();
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };
        ws.getRow(rowNum).height = 24;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: LIGHT_ORANGE_HEX }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      };

      const setKeyValueRow = (ws: ExcelJS.Worksheet, rowNum: number, key: string, val: string) => {
        const keyCell = ws.getCell(`A${rowNum}`);
        keyCell.value = key;
        keyCell.font = { name: 'Arial', size: 10, bold: true };
        keyCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: LIGHT_GRAY_HEX }
        };

        const valCell = ws.getCell(`B${rowNum}`);
        ws.mergeCells(`B${rowNum}:C${rowNum}`);
        valCell.value = val;
        valCell.font = { name: 'Arial', size: 10 };
        valCell.alignment = { wrapText: true, vertical: 'middle' };
        ws.getRow(rowNum).height = 20;
      };

      // 1. Create Summary Tab
      const summarySheet = workbook.addWorksheet('SUMMARY');
      summarySheet.mergeCells('A1:C2');
      const titleCell = summarySheet.getCell('A1');
      titleCell.value = 'HEMRAJ IT AUDIT SUMMARY';
      titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: ORANGE_HEX }
      };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      createSectionHeader(summarySheet, 4, 'Employee Information');
      setKeyValueRow(summarySheet, 5, 'Employee Name', data.employee_name);
      setKeyValueRow(summarySheet, 6, 'Department', data.department);
      setKeyValueRow(summarySheet, 7, 'Designation', data.designation);

      createSectionHeader(summarySheet, 9, 'Audited Sheets List');
      summarySheet.getCell('A10').value = 'Sheet File Name';
      summarySheet.getCell('B10').value = 'Frequency';
      summarySheet.getCell('C10').value = 'Time Spent Daily';
      ['A10', 'B10', 'C10'].forEach(pos => {
        const cell = summarySheet.getCell(pos);
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE_HEX } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      summarySheet.getRow(10).height = 22;

      data.sheets.forEach((sheet, idx) => {
        const rowNum = 11 + idx;
        summarySheet.getCell(`A${rowNum}`).value = sheet.sheet_name;
        summarySheet.getCell(`B${rowNum}`).value = sheet.frequency;
        summarySheet.getCell(`C${rowNum}`).value = sheet.time_spent;
        summarySheet.getRow(rowNum).height = 20;
      });

      summarySheet.getColumn(1).width = 30;
      summarySheet.getColumn(2).width = 25;
      summarySheet.getColumn(3).width = 40;

      // 2. Add Tab for each Sheet
      data.sheets.forEach((sheet, idx) => {
        const sheetTitle = sheet.sheet_name.substring(0, 28) || `Sheet ${idx + 1}`;
        const ws = workbook.addWorksheet(`${idx + 1}_${sheetTitle}`);

        ws.mergeCells('A1:C2');
        const wsTitleCell = ws.getCell('A1');
        wsTitleCell.value = `SHEET REPORT: ${sheet.sheet_name}`;
        wsTitleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        wsTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE_HEX } };
        wsTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

        createSectionHeader(ws, 4, 'Sheet Details');
        setKeyValueRow(ws, 5, 'Sheet Name', sheet.sheet_name);
        setKeyValueRow(ws, 6, 'Google Sheet Link', sheet.google_sheet_link);
        setKeyValueRow(ws, 7, 'Purpose of Sheet', sheet.purpose);
        setKeyValueRow(ws, 8, 'Frequency of Use', sheet.frequency);

        createSectionHeader(ws, 10, 'Access & Responsibility');
        setKeyValueRow(ws, 11, 'Your Role in Sheet', sheet.role.join(', '));

        createSectionHeader(ws, 13, 'Other Info');
        setKeyValueRow(ws, 14, 'Process Supported', sheet.process_supported);
        setKeyValueRow(ws, 15, 'Time Spent Daily', sheet.time_spent);

        ws.getCell('A17').value = 'COLUMNS & CRUD ACTIONS';
        ws.getCell('A17').font = { name: 'Arial', size: 11, bold: true };

        const headers = ['Column Name', 'CRUD Actions', 'Description / Notes'];
        headers.forEach((h, colIndex) => {
          const cell = ws.getCell(18, colIndex + 1);
          cell.value = h;
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE_HEX } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        ws.getRow(18).height = 22;

        sheet.columns.forEach((col, cIdx) => {
          const rowNum = 19 + cIdx;
          ws.getCell(`A${rowNum}`).value = col.columnName;
          ws.getCell(`B${rowNum}`).value = (col.crudActions || []).join(', ');
          ws.getCell(`C${rowNum}`).value = col.notes || '';
          ws.getRow(rowNum).height = 20;
        });

        ws.getColumn(1).width = 30;
        ws.getColumn(2).width = 25;
        ws.getColumn(3).width = 40;
      });

      // Apply borders to all tables
      workbook.worksheets.forEach(ws => {
        ws.eachRow((row) => {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
          });
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Hemraj_IT_Audit_Report_${data.employee_name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
      showToast("Excel exported successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to export Excel", "error");
    }
  };

  // Export all database submissions to a beautifully formatted workbook
  const exportAllToExcel = async () => {
    if (filteredSubmissions.length === 0) {
      showToast("No records to export", "error");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const ORANGE_HEX = 'FFF97316'; // Tailwind Orange-500
      const LIGHT_SLATE_HEX = 'FFF8FAFC'; // Tailwind Slate-50
      const BORDER_COLOR_HEX = 'FFCBD5E1'; // Tailwind Slate-300

      // Styling Helpers
      const applyHeaderStyle = (ws: ExcelJS.Worksheet, numCols: number) => {
        const row = ws.getRow(1);
        row.height = 26;
        for (let c = 1; c <= numCols; c++) {
          const cell = row.getCell(c);
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: ORANGE_HEX }
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      };

      const applyRowStyles = (ws: ExcelJS.Worksheet) => {
        ws.eachRow((row, rowNum) => {
          if (rowNum === 1) return; // skip header
          row.height = 21;
          row.eachCell((cell) => {
            cell.font = { name: 'Arial', size: 10 };
            cell.border = {
              top: { style: 'thin', color: { argb: BORDER_COLOR_HEX } },
              left: { style: 'thin', color: { argb: BORDER_COLOR_HEX } },
              bottom: { style: 'thin', color: { argb: BORDER_COLOR_HEX } },
              right: { style: 'thin', color: { argb: BORDER_COLOR_HEX } }
            };
            if (rowNum % 2 === 0) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: LIGHT_SLATE_HEX }
              };
            }
          });
        });
      };

      const autoFitColumns = (ws: ExcelJS.Worksheet) => {
        ws.columns.forEach(column => {
          let maxLen = 0;
          column.eachCell?.({ includeEmpty: true }, cell => {
            const valStr = cell.value ? String(cell.value) : '';
            if (valStr.length > maxLen) {
              maxLen = valStr.length;
            }
          });
          column.width = Math.min(Math.max(maxLen + 4, 12), 50);
        });
      };

      // 1. SUMMARY Tab
      const summarySheet = workbook.addWorksheet('SUMMARY');
      const summaryHeaders = ['Submission Date', 'Employee Name', 'Department', 'Designation', 'Total Sheets Audited'];
      summarySheet.addRow(summaryHeaders);

      // 2. SHEETS Tab
      const sheetsSheet = workbook.addWorksheet('SHEETS_DETAIL');
      const sheetsHeaders = [
        'Submission Date', 'Employee Name', 'Department', 'Designation', 
        'Sheet Name', 'Google Sheet Link', 'Purpose of the Sheet', 
        'Usage Frequency', 'Employee Role', 'Process Supported', 'Time Spent Daily'
      ];
      sheetsSheet.addRow(sheetsHeaders);

      // 3. COLUMNS Tab
      const columnsSheet = workbook.addWorksheet('COLUMNS_MAPPING');
      const columnsHeaders = [
        'Submission Date', 'Employee Name', 'Department', 'Designation', 
        'Sheet Name', 'Google Sheet Link', 'Column Name', 'CRUD Actions', 'Notes'
      ];
      columnsSheet.addRow(columnsHeaders);

      // Populate data from all filtered submissions
      filteredSubmissions.forEach(sub => {
        const dateStr = sub.created_at ? new Date(sub.created_at).toLocaleDateString('en-IN') : 'N/A';
        
        summarySheet.addRow([
          dateStr,
          sub.employee_name,
          sub.department,
          sub.designation,
          sub.sheets?.length || 0
        ]);

        sub.sheets?.forEach(sheet => {
          sheetsSheet.addRow([
            dateStr,
            sub.employee_name,
            sub.department,
            sub.designation,
            sheet.sheet_name,
            sheet.google_sheet_link,
            sheet.purpose,
            sheet.frequency,
            (sheet.role || []).join(', '),
            sheet.process_supported,
            sheet.time_spent
          ]);

          sheet.columns?.forEach(col => {
            columnsSheet.addRow([
              dateStr,
              sub.employee_name,
              sub.department,
              sub.designation,
              sheet.sheet_name,
              sheet.google_sheet_link,
              col.columnName,
              (col.crudActions || []).join(', '),
              col.notes || ''
            ]);
          });
        });
      });

      // Apply formatting to sheets
      applyHeaderStyle(summarySheet, summaryHeaders.length);
      applyHeaderStyle(sheetsSheet, sheetsHeaders.length);
      applyHeaderStyle(columnsSheet, columnsHeaders.length);

      applyRowStyles(summarySheet);
      applyRowStyles(sheetsSheet);
      applyRowStyles(columnsSheet);

      autoFitColumns(summarySheet);
      autoFitColumns(sheetsSheet);
      autoFitColumns(columnsSheet);

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Hemraj_IT_Audit_All_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast("All data exported successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to export all data", "error");
    }
  };

  const handleExportCurrent = () => {
    if (!validateForm()) return;
    const activeSheets = sheets.map(sheet => ({
      ...sheet,
      columns: sheet.columns.filter(c => c.columnName.trim())
    }));
    const mockSubmission: ItAuditSubmission = {
      employee_name: employeeName.trim(),
      department,
      designation: designation.trim(),
      sheets: activeSheets
    };
    exportToExcel(mockSubmission);
  };

  // Filter Submissions History
  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = 
      sub.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.sheets.some(s => s.sheet_name.toLowerCase().includes(searchTerm.toLowerCase()) || s.process_supported.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDept = deptFilter === 'ALL' || sub.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const activeSheet = sheets[selectedSheetIndex];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center border border-orange-200">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">IT Audit Form</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">HEMRAJ GROUP INTERNAL SHEET AUDIT</p>
          </div>
        </div>

        {/* Tab Controls (Only show tab selector to admins) */}
        {isAdmin && (
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 self-start sm:self-center">
            <button
              onClick={() => setActiveTab('form')}
              className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'form'
                  ? 'bg-white dark:bg-slate-800 text-orange-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Submit Audit
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-800 text-orange-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <History className="w-3.5 h-3.5" /> History ({submissions.length || '...'})
            </button>
          </div>
        )}
      </div>

      {activeTab === 'form' ? (
        <div className="space-y-6">
          {/* Employee Info Section (Global) */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-100 dark:border-slate-850">
              <User className="w-5 h-5 text-orange-500" />
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">1. Employee Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employee Name *</label>
                <input
                  type="text"
                  value={employeeName}
                  onChange={e => setEmployeeName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full px-4 py-2.5 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Department *</label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-800 dark:text-slate-100"
                >
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Designation *</label>
                <input
                  type="text"
                  value={designation}
                  onChange={e => setDesignation(e.target.value)}
                  placeholder="Enter job designation"
                  className="w-full px-4 py-2.5 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            </div>
          </div>

          {/* Sheets Navigation Tab Bar */}
          <div className="bg-slate-100 dark:bg-slate-900 p-2.5 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 overflow-x-auto">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {sheets.map((sheet, index) => (
                <div 
                  key={index} 
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl border transition-all ${
                    selectedSheetIndex === index
                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm text-orange-600 font-extrabold'
                      : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSheetIndex(index)}
                    className="text-xs font-black uppercase tracking-wider cursor-pointer"
                  >
                    {sheet.sheet_name.trim() || `Sheet #${index + 1}`}
                  </button>
                  {sheets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSheet(index)}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addSheet}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Sheet
            </button>
          </div>

          {/* Active Sheet Forms and Dynamic Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              
              {/* Sheet Details Section */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-100 dark:border-slate-850">
                  <FileSpreadsheet className="w-5 h-5 text-orange-500" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">
                    2. Sheet Details ({activeSheet.sheet_name || `Sheet #${selectedSheetIndex + 1}`})
                  </h3>
                </div>
                
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Google Sheet / Excel File Name *</label>
                      <input
                        type="text"
                        value={activeSheet.sheet_name}
                        onChange={e => updateSheetValue('sheet_name', e.target.value)}
                        placeholder="e.g. Purchase Tracking 2026"
                        className="w-full px-4 py-2.5 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Usage Frequency *</label>
                      <select
                        value={activeSheet.frequency}
                        onChange={e => updateSheetValue('frequency', e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-800 dark:text-slate-100"
                      >
                        <option value="">Select Frequency</option>
                        {FREQUENCIES.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Google Sheet Link *</label>
                    <div className="relative">
                      <input
                        type="url"
                        value={activeSheet.google_sheet_link}
                        onChange={e => updateSheetValue('google_sheet_link', e.target.value)}
                        placeholder="Paste full Google Sheets URL here"
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-blue-600 underline"
                      />
                      {activeSheet.google_sheet_link.startsWith('http') && (
                        <a 
                          href={activeSheet.google_sheet_link} 
                          target="_blank" 
                          rel="noreferrer"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Purpose of the Sheet *</label>
                    <textarea
                      rows={3}
                      value={activeSheet.purpose}
                      onChange={e => updateSheetValue('purpose', e.target.value)}
                      placeholder="Describe what this sheet is used for"
                      className="w-full px-4 py-2.5 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Columns Config Table with Simplified Multi-select Toggles */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100 dark:border-slate-850">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-orange-500" />
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">5. Sheet Columns Mapping</h3>
                      <p className="text-[10px] text-slate-400 font-semibold tracking-tighter">Toggle column CRUD permissions (Create, View, Edit, Delete, Approve)</p>
                    </div>
                  </div>
                  <button
                    onClick={addColumnRow}
                    className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Column
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-150 dark:border-slate-800 rounded-2xl">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800">
                        <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-left text-slate-400 w-1/4">Column Name *</th>
                        <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-center text-slate-400">CRUD Actions</th>
                        <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-left text-slate-400 w-1/3">Notes</th>
                        <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-center text-slate-400 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSheet.columns.map((col, idx) => (
                        <tr key={idx} className="border-b border-slate-150 dark:border-slate-800/50 last:border-b-0">
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={col.columnName}
                              onChange={e => updateColumnValue(idx, 'columnName', e.target.value)}
                              placeholder="e.g. PO_Number"
                              className="w-full px-3 py-1.5 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                            />
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center justify-center gap-1">
                              {CRUD_OPTIONS.map(flag => {
                                const active = (col.crudActions || []).includes(flag.key);
                                return (
                                  <button
                                    key={flag.key}
                                    type="button"
                                    onClick={() => {
                                      const current = col.crudActions || [];
                                      const next = current.includes(flag.key)
                                        ? current.filter(x => x !== flag.key)
                                        : [...current, flag.key];
                                      updateColumnValue(idx, 'crudActions', next);
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                                      active
                                        ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                                        : 'bg-slate-50 dark:bg-slate-950 text-slate-400 border-slate-200 dark:border-slate-805 hover:bg-slate-100'
                                    }`}
                                  >
                                    {flag.label}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={col.notes || ''}
                              onChange={e => updateColumnValue(idx, 'notes', e.target.value)}
                              placeholder="Notes on field use"
                              className="w-full px-3 py-1.5 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => removeColumnRow(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Side Panels */}
            <div className="space-y-6">
              
              {/* Access Panel */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-100 dark:border-slate-850">
                  <Briefcase className="w-5 h-5 text-orange-500" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">3. Access & Responsibility</h3>
                </div>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Your Role in this Sheet *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {ROLES.map(role => {
                        const checked = (activeSheet.role || []).includes(role);
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => handleRoleToggle(role)}
                            className={`px-3 py-2 text-left rounded-xl border text-[10px] font-black uppercase tracking-tight transition-all cursor-pointer ${
                              checked
                                ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-300 text-orange-600'
                                : 'bg-slate-55 dark:bg-slate-950 border-slate-200 dark:border-slate-805 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Other Info Panel */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-100 dark:border-slate-850">
                  <Clock className="w-5 h-5 text-orange-500" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">4. Other Info</h3>
                </div>
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Process Supported *</label>
                    <input
                      type="text"
                      value={activeSheet.process_supported}
                      onChange={e => updateSheetValue('process_supported', e.target.value)}
                      placeholder="e.g. Sales Tracking, PO Creation"
                      className="w-full px-4 py-2.5 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Time Spent Per Day *</label>
                    <div className="space-y-2">
                      {TIME_SPENT_OPTIONS.map(opt => (
                        <label 
                          key={opt}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                            activeSheet.time_spent === opt
                              ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-300 text-orange-600'
                              : 'bg-slate-55 dark:bg-slate-950 border-slate-200 dark:border-slate-805 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="timeSpent"
                            value={opt}
                            checked={activeSheet.time_spent === opt}
                            onChange={() => updateSheetValue('time_spent', opt)}
                            className="text-orange-500 focus:ring-orange-500"
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Actions Panel */}
              <div className="bg-slate-900 text-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-orange-400">Submit IT Audit Details</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                  Saves all sheet mappings ({sheets.length} sheets defined) under your employee profile.
                </p>
                <div className="grid grid-cols-1 gap-3 pt-2">
                  <button
                    onClick={handleSaveForm}
                    disabled={loading}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      "Save Form Data"
                    )}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={handleExportCurrent}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-wider border border-slate-700 flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-orange-500" /> Export to Excel
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      ) : (
        /* History / DB Submissions List */
        isAdmin && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-orange-500" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">Database History</h3>
                  <p className="text-[10px] text-slate-400 font-semibold tracking-tighter">View, download, and manage employee sheet audit logs</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Employee, Sheet..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs font-semibold focus:outline-none"
                  />
                </div>

                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs font-bold text-slate-500"
                >
                  <option value="ALL">All Departments</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <button
                  onClick={exportAllToExcel}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
                  title="Export all data to a single workbook"
                >
                  <Download className="w-4 h-4" /> Export All
                </button>
              </div>
            </div>

            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Loading history...</p>
              </div>
            ) : filteredSubmissions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800">
                      <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-left text-slate-400">Date</th>
                      <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-left text-slate-400">Employee</th>
                      <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-left text-slate-400">Dept</th>
                      <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-left text-slate-400">Sheets Audited</th>
                      <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-center text-slate-400">Total Sheets</th>
                      <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-center text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map(sub => (
                      <tr key={sub.id} className="border-b border-slate-150 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-955/20">
                        <td className="py-3 px-4 text-xs font-semibold text-slate-400">
                          {sub.created_at ? new Date(sub.created_at).toLocaleDateString('en-IN') : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-xs font-bold text-slate-955 dark:text-slate-100">
                          {sub.employee_name}
                          <span className="block text-[10px] text-slate-400 font-medium mt-0.5">{sub.designation}</span>
                        </td>
                        <td className="py-3 px-4 text-xs font-bold uppercase text-slate-500">
                          {sub.department}
                        </td>
                        <td className="py-3 px-4 text-xs font-bold text-slate-800 dark:text-slate-200">
                          <div className="flex flex-wrap gap-1">
                            {sub.sheets?.map((s, sIdx) => (
                              <span key={sIdx} className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[10px] text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                                {s.sheet_name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center text-xs font-bold text-slate-500">
                          {sub.sheets?.length || 0}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => exportToExcel(sub)}
                              className="p-1.5 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 rounded-xl transition-colors cursor-pointer"
                              title="Export to Excel"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(sub.id!)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 rounded-xl transition-colors cursor-pointer"
                              title="Delete submission"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 dark:text-slate-600 font-bold text-xs uppercase tracking-widest">
                No audit records found
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default ItAuditForm;
