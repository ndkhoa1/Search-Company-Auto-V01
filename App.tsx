import React, { useState, useRef } from 'react';
import BulkSearchForm from './components/BulkSearchForm';
import ResultTable from './components/ResultTable';
import { searchCompanyInfo } from './services/geminiService';
import { SearchState, SearchResultItem, CompanyData } from './types';
import * as XLSX from 'xlsx';

// --- APPS SCRIPT CODE START ---
const APPS_SCRIPT_CODE = `/**
 * ======================================================================================
 * HƯỚNG DẪN TẠO MENU TRÊN THANH CÔNG CỤ (KHÔNG CẦN VẼ NÚT)
 * ======================================================================================
 * 1. Copy toàn bộ code này.
 * 2. Mở Google Sheet -> Tiện ích mở rộng -> Apps Script.
 * 3. Dán code vào và nhấn Save (Lưu).
 * 4. F5 lại Google Sheet. Menu "BizSearch VN" sẽ hiện ra.
 * ======================================================================================
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('BizSearch VN')
    .addItem('Dán kết quả JSON', 'pasteJSONData')
    .addToUi();
}

function pasteJSONData() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var targetSheet = ss.getSheetByName("Data");
  if (!targetSheet) {
    targetSheet = ss.getActiveSheet();
  }

  var result = ui.prompt(
    'BizSearch Tool (Ghi vào: ' + targetSheet.getName() + ')',
    'Vui lòng dán chuỗi JSON đã copy từ Website vào đây:',
    ui.ButtonSet.OK_CANCEL
  );

  var button = result.getSelectedButton();
  var jsonText = result.getResponseText();

  if (button == ui.Button.OK && jsonText) {
    try {
      var data = JSON.parse(jsonText);
      updateSheetWithData(data, targetSheet);
    } catch (e) {
      ui.alert('Lỗi: Dữ liệu dán vào không đúng định dạng JSON.\\n' + e.toString());
    }
  }
}

function updateSheetWithData(inputData, sheet) {
  var ui = SpreadsheetApp.getUi();
  sheet.activate();

  var COL_NAME = 4;   // Cột D
  var COL_DOMAIN = 5; // Cột E
  var COL_TAX = 6;    // Cột F

  var lastRow = sheet.getLastRow();
  if (lastRow < 1) lastRow = 1;

  var range = sheet.getRange(2, COL_NAME, lastRow, 3); 
  var values = range.getValues(); 

  var companyMap = {}; 
  var emptyRows = [];  

  for (var i = 0; i < values.length; i++) {
    var rowIndex = i + 2; 
    var name = values[i][0];
    
    if (name && name.toString().trim() !== "") {
      var key = name.toString().toLowerCase().trim();
      if (!companyMap[key]) {
        companyMap[key] = [];
      }
      companyMap[key].push(rowIndex);
    } else {
      if (!values[i][1] && !values[i][2]) {
        emptyRows.push(rowIndex);
      }
    }
  }

  var updatedCount = 0;
  var addedCount = 0;
  var newRows = [];

  inputData.forEach(function(item) {
    if (!item.name) return;
    var searchKey = item.name.toString().toLowerCase().trim();
    
    if (companyMap[searchKey]) {
      var rowsToUpdate = companyMap[searchKey];
      rowsToUpdate.forEach(function(r) {
        var cellDomain = sheet.getRange(r, COL_DOMAIN);
        var cellTax = sheet.getRange(r, COL_TAX);
        
        if (cellDomain.getValue() === "" && item.domain) {
          cellDomain.setValue(item.domain);
          updatedCount++;
        }
        if (cellTax.getValue() === "" && item.tax) {
          cellTax.setValue(item.tax);
          updatedCount++;
        }
      });
    } else {
      newRows.push([item.name, item.domain || "", item.tax || ""]);
    }
  });

  if (newRows.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    if (startRow === 1 && sheet.getRange(1, COL_NAME).getValue() !== "") startRow = 2;
    sheet.getRange(startRow, COL_NAME, newRows.length, 3).setValues(newRows);
    addedCount += newRows.length;
  }

  ui.alert("✅ Đã xử lý xong trên Sheet: " + sheet.getName() + "\\n- Cập nhật: " + updatedCount + "\\n- Thêm mới: " + addedCount);
}`;
// --- APPS SCRIPT CODE END ---

const App: React.FC = () => {
  const [searchState, setSearchState] = useState<SearchState>({
    isProcessing: false,
    results: [],
    sheetHeaders: [],
    sheetRows: []
  });
  
  const [isPaused, setIsPaused] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'script_copied' | 'json_copied'>('idle');

  const shouldStopRef = useRef(false);
  const isPausedRef = useRef(false);

  const updateVirtualSheet = (
    currentRows: string[][], 
    resultData: CompanyData, 
    inputName: string
  ): { updatedRows: string[][], history: string } => {
    const newRows = [...currentRows];
    const targetName = inputName.toLowerCase().trim();
    
    let matchIndex = -1;
    for (let i = 1; i < newRows.length; i++) {
        const rowName = (newRows[i][3] || '').toLowerCase().trim();
        if (rowName === targetName) {
            matchIndex = i;
            break;
        }
    }

    if (matchIndex !== -1) {
        const row = newRows[matchIndex];
        const updates: string[] = [];
        while (row.length < 6) row.push('');

        if (!row[4] || row[4].trim() === '') {
            row[4] = resultData.domain;
            updates.push(`E${matchIndex + 1}`);
        }
        if (!row[5] || row[5].trim() === '') {
            row[5] = resultData.taxCode;
            updates.push(`F${matchIndex + 1}`);
        }
        return { 
            updatedRows: newRows, 
            history: updates.length > 0 ? `Cập nhật: ${updates.join(', ')}` : 'Dữ liệu đã đầy đủ'
        };
    }

    let lastDataRowIndex = 0; 
    for (let i = newRows.length - 1; i >= 0; i--) {
        if (newRows[i][3] && newRows[i][3].trim() !== '') {
            lastDataRowIndex = i;
            break;
        }
    }

    let targetIndex = lastDataRowIndex + 1;
    
    if (targetIndex < newRows.length) {
        const row = newRows[targetIndex];
        while (row.length < 6) row.push('');
        
        row[3] = inputName;
        row[4] = resultData.domain;
        row[5] = resultData.taxCode;
        
        return { 
            updatedRows: newRows, 
            history: `Điền vào dòng: ${targetIndex + 1}`
        };
    } else {
        const newRow = new Array(Math.max(6, newRows[0]?.length || 6)).fill('');
        newRow[3] = inputName;
        newRow[4] = resultData.domain;
        newRow[5] = resultData.taxCode;
        newRows.push(newRow);
        
        return { 
            updatedRows: newRows, 
            history: `Thêm dòng mới: ${newRows.length}`
        };
    }
  };

  const handleStop = () => {
    shouldStopRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
  };

  const handleTogglePause = () => {
    const nextState = !isPaused;
    setIsPaused(nextState);
    isPausedRef.current = nextState;
  };

  const handleRetryItem = async (id: string, newName: string) => {
      setSearchState(prev => ({
          ...prev,
          isProcessing: true,
          results: prev.results.map(item => item.id === id ? { ...item, status: 'loading', inputName: newName, error: undefined, selected: true } : item)
      }));

      try {
        const data = await searchCompanyInfo(newName);
        let history = "";
        let currentSheetRows = [...searchState.sheetRows];

        if (currentSheetRows.length > 0) {
            const updateResult = updateVirtualSheet(currentSheetRows, data, newName);
            currentSheetRows = updateResult.updatedRows;
            history = updateResult.history;
        }

        setSearchState(prev => ({
            ...prev,
            isProcessing: prev.results.some(r => r.status === 'loading' && r.id !== id),
            sheetRows: currentSheetRows,
            results: prev.results.map(item => item.id === id ? { ...item, inputName: newName, status: 'success', data: data, updateHistory: history } : item)
        }));
      } catch (err: any) {
         setSearchState(prev => ({
            ...prev,
            isProcessing: prev.results.some(r => r.status === 'loading' && r.id !== id),
            results: prev.results.map(item => item.id === id ? { ...item, status: 'error', error: err.message } : item)
        }));
      }
  };

  const handleLoadData = (terms: string[], rawSheetRows?: string[][]) => {
    const sheetData = rawSheetRows || [];
    
    const sheetMap = new Map<string, string[]>();
    if (sheetData.length > 0) {
        sheetData.forEach((row, index) => {
            if (index > 0 && row[3]) {
                const key = row[3].toLowerCase().trim();
                sheetMap.set(key, row);
            }
        });
    }

    const results: SearchResultItem[] = terms.map((term, index) => {
        let isSkipped = false;
        let existingData: any = null;

        if (sheetMap.size > 0) {
            const targetName = term.toLowerCase().trim();
            const row = sheetMap.get(targetName);
            
            if (row && row[4]?.trim() && row[5]?.trim()) {
                isSkipped = true;
                existingData = { 
                    domain: row[4], 
                    taxCode: row[5], 
                    summary: 'Dữ liệu đã có sẵn trong file.' 
                };
            }
        }

        return {
            id: `row-${Date.now()}-${index}`,
            inputName: term,
            status: isSkipped ? 'skipped' : 'pending',
            selected: !isSkipped, 
            isSkipped: isSkipped,
            data: existingData
        };
    });

    setSearchState({
      isProcessing: false,
      results,
      sheetHeaders: sheetData.length > 0 ? sheetData[0] : [],
      sheetRows: sheetData,
    });
  };

  const handleStartProcessing = async () => {
    shouldStopRef.current = false;
    isPausedRef.current = false;
    setIsPaused(false);
    
    setSearchState(prev => ({ ...prev, isProcessing: true }));

    const currentResults = [...searchState.results];
    let currentSheetRows = [...searchState.sheetRows];

    for (let i = 0; i < currentResults.length; i++) {
      const item = currentResults[i];
      if (!item.selected || item.status === 'success' || item.status === 'skipped') continue;

      if (shouldStopRef.current) break;
      while (isPausedRef.current) {
        if (shouldStopRef.current) break;
        await new Promise(r => setTimeout(r, 200));
      }

      currentResults[i] = { ...currentResults[i], status: 'loading' };
      setSearchState(prev => ({ ...prev, results: [...currentResults] }));

      await new Promise(r => setTimeout(r, 2000));

      try {
        const data = await searchCompanyInfo(item.inputName);
        let history = "";
        
        if (currentSheetRows.length > 0) {
            const updateResult = updateVirtualSheet(currentSheetRows, data, item.inputName);
            currentSheetRows = updateResult.updatedRows;
            history = updateResult.history;
        }

        currentResults[i] = { 
            ...currentResults[i], 
            status: 'success', 
            data: data,
            updateHistory: history
        };
      } catch (err: any) {
        currentResults[i] = { ...currentResults[i], status: 'error', error: err.message };
      }

      setSearchState(prev => ({ 
        ...prev, 
        results: [...currentResults],
        sheetRows: currentSheetRows
      }));
    }

    setSearchState(prev => ({ ...prev, isProcessing: false }));
  };

  const handleToggleSelect = (id: string) => {
      setSearchState(prev => ({
          ...prev,
          results: prev.results.map(r => r.id === id ? { ...r, selected: !r.selected } : r)
      }));
  };

  const handleSelectAll = (select: boolean) => {
      setSearchState(prev => ({
          ...prev,
          results: prev.results.map(r => ({ ...r, selected: select }))
      }));
  };

  const handleRangeSelect = (startIndex: number, endIndex: number, selected: boolean) => {
    setSearchState(prev => {
        const newResults = [...prev.results];
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);

        for (let i = start; i <= end; i++) {
            if (newResults[i].status !== 'success' && newResults[i].status !== 'skipped') {
                newResults[i].selected = selected;
            }
        }
        return { ...prev, results: newResults };
    });
  };

  // --- NEW HANDLERS FOR LEFT SIDEBAR ---
  const handleExport = () => {
    let dataToExport;
    const hasSheetData = searchState.sheetRows && searchState.sheetRows.length > 0;
    if (hasSheetData) {
        dataToExport = searchState.sheetRows || [];
    } else {
        const headers = ["Tên công ty", "Domain", "Mã số thuế"];
        const rows = searchState.results.map(r => [
            r.inputName,
            r.data?.domain || (r.status === 'error' ? 'Lỗi' : ''),
            r.data?.taxCode || (r.status === 'error' ? 'Lỗi' : '')
        ]);
        dataToExport = [headers, ...rows];
    }
    const filename = hasSheetData ? "BizSearch_Updated_Sheet.xlsx" : "BizSearch_Results.xlsx";
    const ws = XLSX.utils.aoa_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KetQua");
    XLSX.writeFile(wb, filename);
  };

  const handleCopyJSON = () => {
    const payload = searchState.results
        .map((item) => {
            if ((item.status === 'success' || item.status === 'skipped') && item.data) {
                return {
                    name: item.inputName,
                    domain: item.data.domain,
                    tax: item.data.taxCode
                };
            }
            return null;
        })
        .filter(Boolean);

    const jsonString = JSON.stringify(payload);
    navigator.clipboard.writeText(jsonString);
    setCopyStatus('json_copied');
    setTimeout(() => setCopyStatus('idle'), 3000);
  };

  const handleCopyScript = () => {
      navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      setCopyStatus('script_copied');
      setTimeout(() => setCopyStatus('idle'), 3000);
  };

  const selectedCount = searchState.results.filter(r => r.selected && r.status !== 'success' && r.status !== 'skipped').length;
  const processedCount = searchState.results.filter(r => r.status !== 'pending' && r.status !== 'loading' && r.status !== 'skipped').length;
  const totalInQueue = searchState.results.filter(r => r.selected).length;
  const progressPercentage = totalInQueue > 0 ? Math.round((processedCount / totalInQueue) * 100) : 0;
  const totalResults = searchState.results.length;

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6 font-inter">
      <div className="max-w-[1920px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* === LEFT COLUMN: HEADER, INPUT & CONTROLS === */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4 lg:sticky lg:top-6 flex flex-col h-full">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {/* Header */}
            <div className="flex flex-col gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                 <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                   Search Company Auto
                 </h1>
                 <p className="text-sm text-slate-500 mt-1">Tra cứu & điền MST/Domain tự động</p>
              </div>
            </div>
            
            <div className="h-px bg-gray-100 my-4"></div>
            
            {/* Input Form */}
            <BulkSearchForm onSearch={handleLoadData} isProcessing={searchState.isProcessing} />
            
            {/* Action Panel (Moved from Right) */}
            {totalResults > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-100 space-y-3 animate-fade-in">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Chức năng</h3>
                    
                    {/* Primary Action */}
                    <button 
                        onClick={handleStartProcessing}
                        disabled={selectedCount === 0 || searchState.isProcessing}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold text-sm shadow-md disabled:opacity-50 flex items-center justify-center gap-2 transition-all mb-4"
                    >
                        {searchState.isProcessing ? (
                            <><svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Đang xử lý...</>
                        ) : (
                            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Bắt đầu xử lý ({selectedCount})</>
                        )}
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                         <button 
                            onClick={handleExport} 
                            className="flex items-center justify-center gap-2 text-xs font-bold text-white px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 transition-all shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Xuất Excel
                        </button>
                         <button
                            onClick={() => setHideCompleted(!hideCompleted)}
                            className={`flex items-center justify-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border transition-all shadow-sm ${
                                hideCompleted 
                                ? 'bg-blue-50 border-blue-200 text-blue-700' 
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {hideCompleted ? 'Hiện đủ' : 'Ẩn đã có'}
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={handleCopyJSON}
                            className={`flex items-center justify-center gap-1 text-xs font-bold text-white px-3 py-2 rounded-lg shadow-sm transition-all ${copyStatus === 'json_copied' ? 'bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600'}`}
                            title="Copy JSON"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                            {copyStatus === 'json_copied' ? 'Đã copy' : 'Copy JSON'}
                        </button>
                        <button 
                            onClick={() => setShowScriptModal(true)}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors border border-gray-200 shadow-sm text-xs font-bold"
                            title="Script Menu"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                            Script
                        </button>
                    </div>
                </div>
            )}
          </div>
          
           <footer className="text-center text-slate-400 text-xs p-4 mt-auto">
              <p>&copy; {new Date().getFullYear()} BizSearch VN.</p>
              <p>Powered by Dang Khoa & Gemini 2.0</p>
          </footer>
        </div>

        {/* === RIGHT COLUMN: RESULTS === */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          
          {searchState.results.length > 0 && !searchState.isProcessing && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap justify-between items-center gap-4 sticky top-0 z-20">
                  <div className="flex items-center gap-4">
                      <button onClick={() => handleSelectAll(true)} className="text-xs font-bold text-blue-600 hover:underline">Chọn tất cả</button>
                      <button onClick={() => handleSelectAll(false)} className="text-xs font-bold text-gray-500 hover:underline">Bỏ chọn</button>
                      <span className="text-sm text-gray-600 border-l pl-4 border-gray-200">Đã chọn: <b className="text-blue-600">{selectedCount}</b></span>
                  </div>
              </div>
          )}

          {searchState.results.length === 0 && !searchState.isProcessing && (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center h-[500px] flex flex-col items-center justify-center text-gray-400">
                  <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                  <p className="text-lg">Chưa có dữ liệu.</p>
                  <p className="text-sm">Vui lòng nhập Link Sheet hoặc danh sách công ty ở cột bên trái.</p>
              </div>
          )}

          <ResultTable 
            results={searchState.results} 
            sheetRows={searchState.sheetRows}
            onRetry={handleRetryItem}
            onToggleSelect={handleToggleSelect}
            onRangeSelect={handleRangeSelect}
            isProcessing={searchState.isProcessing}
            hideCompleted={hideCompleted}
          />
        </div>
      </div>

      {/* FLOATING ACTION BAR (Processing State) */}
      {searchState.isProcessing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/90 backdrop-blur border border-blue-200 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 animate-fade-in-up">
            <div className="flex flex-col">
                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Tiến độ</span>
                <span className="text-sm font-bold text-blue-700">{processedCount} / {totalInQueue} ({progressPercentage}%)</span>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <button onClick={handleTogglePause} className="flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all bg-yellow-50 text-yellow-700 hover:bg-yellow-100">
                {isPaused ? (
                  <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg> Tiếp tục</>
                ) : (
                  <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg> Tạm dừng</>
                )}
            </button>
            <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm bg-red-50 text-red-700 hover:bg-red-100">Dừng</button>
        </div>
      )}

      {/* SCRIPT MODAL */}
      {showScriptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                      <h3 className="text-lg font-bold text-gray-800">Hướng dẫn cài đặt Menu BizSearch</h3>
                      <button onClick={() => setShowScriptModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-6">
                      <div className="space-y-3">
                          <div className="flex items-center gap-2">
                              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">1</span>
                              <h4 className="font-semibold text-gray-900">Cập nhật Script vào Google Sheet</h4>
                          </div>
                          <div className="ml-8 text-sm text-gray-600 space-y-2">
                              <p>Mở Sheet của bạn &rarr; chọn <b>Tiện ích mở rộng (Extensions)</b> &rarr; <b>Apps Script</b>.</p>
                              <div className="relative group">
                                  {/* INCREASED HEIGHT HERE */}
                                  <pre className="bg-slate-800 text-slate-200 p-4 rounded-lg text-xs font-mono overflow-x-auto h-96">
                                      {APPS_SCRIPT_CODE}
                                  </pre>
                                  <button onClick={handleCopyScript} className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white text-xs px-2 py-1 rounded transition-colors">{copyStatus === 'script_copied' ? 'Đã copy!' : 'Copy Code'}</button>
                              </div>
                          </div>
                      </div>
                      <div className="ml-8 text-sm text-gray-500">Sau khi Save, hãy F5 lại trang Google Sheet để thấy menu <b>BizSearch VN</b> xuất hiện.</div>
                  </div>
                  <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end">
                      <button onClick={() => setShowScriptModal(false)} className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors">Đóng</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;