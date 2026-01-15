import React, { useState, useEffect, useMemo } from 'react';
import { SearchResultItem } from '../types';

interface ResultTableProps {
  results: SearchResultItem[];
  sheetRows?: string[][]; 
  onRetry: (id: string, newName: string) => void;
  onToggleSelect: (id: string) => void;
  onRangeSelect: (startIndex: number, endIndex: number, selected: boolean) => void;
  isProcessing: boolean;
  hideCompleted: boolean;
}

const ITEMS_PER_PAGE = 100;

const ResultTable: React.FC<ResultTableProps> = ({ results, onRetry, onToggleSelect, onRangeSelect, isProcessing, hideCompleted }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const visibleResults = useMemo(() => {
    let filtered = results;
    
    // 1. Filter by status (Hide Completed)
    if (hideCompleted) {
        filtered = filtered.filter(r => r.status !== 'success' && r.status !== 'skipped');
    }

    // 2. Filter by search term
    if (filterTerm.trim()) {
        const term = filterTerm.toLowerCase().trim();
        filtered = filtered.filter(r => r.inputName.toLowerCase().includes(term));
    }

    return filtered;
  }, [results, hideCompleted, filterTerm]);

  const totalPages = Math.ceil(visibleResults.length / ITEMS_PER_PAGE);

  // Reset page when filter results change length significantly
  useEffect(() => {
    if (currentPage > totalPages) {
        setCurrentPage(Math.max(1, totalPages));
    }
  }, [visibleResults.length, totalPages, currentPage]);

  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  if (results.length === 0) return null;

  const currentData = visibleResults.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleStartEdit = (item: SearchResultItem) => {
    setEditingId(item.id);
    setEditName(item.inputName);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSubmitRetry = (id: string) => {
    if (editName.trim()) {
      onRetry(id, editName);
      setEditingId(null);
    }
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>, item: SearchResultItem) => {
    const isChecked = e.target.checked;
    const originalIndex = results.indexOf(item);
    if ((e.nativeEvent as any).shiftKey && lastClickedIndex !== null) {
        onRangeSelect(lastClickedIndex, originalIndex, isChecked);
    } else {
        onToggleSelect(item.id);
    }
    setLastClickedIndex(originalIndex);
  };

  return (
    <div className="w-full animate-fade-in-up pb-12">
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 justify-between">
        
        {/* Left Side: Title + Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1 w-full">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap min-w-fit">
                Kết quả <span className="text-sm font-normal text-gray-500">({visibleResults.length})</span>
            </h2>

             {/* Search Input */}
            <div className="relative w-full sm:w-64 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <svg className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                     </svg>
                </div>
                <input
                    type="text"
                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition duration-150 ease-in-out shadow-sm"
                    placeholder="Tìm tên công ty..."
                    value={filterTerm}
                    onChange={(e) => setFilterTerm(e.target.value)}
                />
            </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[400px] relative">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-3 py-3 w-8 bg-gray-50"></th>
                <th className="px-3 py-3 font-semibold text-gray-900 w-10 bg-gray-50">#</th>
                <th className="px-4 py-3 font-semibold text-gray-900 w-3/12 bg-gray-50">Công ty</th>
                <th className="px-4 py-3 font-semibold text-gray-900 w-2/12 bg-gray-50">Domain</th>
                <th className="px-4 py-3 font-semibold text-gray-900 w-2/12 bg-gray-50">MST</th>
                <th className="px-4 py-3 font-semibold text-gray-900 w-2/12 bg-gray-50">Vị trí</th>
                <th className="px-4 py-3 font-semibold text-gray-900 w-2/12 text-center bg-gray-50">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentData.map((item) => {
                const absoluteIndex = results.indexOf(item);
                
                return (
                    <tr key={item.id} className={`hover:bg-blue-50/30 transition-colors ${item.status === 'skipped' ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                    <td className="px-3 py-3 text-center">
                        <input 
                            type="checkbox" 
                            checked={item.selected} 
                            onChange={(e) => handleCheckboxChange(e, item)}
                            disabled={isProcessing || item.status === 'success' || item.status === 'skipped'}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30 cursor-pointer"
                        />
                    </td>
                    <td className="px-3 py-3 text-gray-400 font-mono text-xs">{absoluteIndex + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                        {editingId === item.id ? (
                            <div className="flex flex-col gap-2">
                                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full p-1 border border-blue-300 rounded text-xs" autoFocus />
                                <div className="flex gap-2">
                                    <button onClick={() => handleSubmitRetry(item.id)} className="px-2 py-1 bg-blue-600 text-white text-xs rounded">Lưu</button>
                                    <button onClick={handleCancelEdit} className="px-2 py-1 bg-gray-200 text-xs rounded">Hủy</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group">
                                <span className="line-clamp-2">{item.inputName}</span>
                                <button onClick={() => handleStartEdit(item)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-500"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                            </div>
                        )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-700 truncate max-w-[120px]" title={item.data?.domain}>{item.data?.domain || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-800">{item.data?.taxCode || '-'}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-gray-500 truncate max-w-[100px]" title={item.updateHistory}>
                        {item.updateHistory || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                        {item.status === 'loading' && <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>}
                        {item.status === 'success' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">OK</span>}
                        {item.status === 'error' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 group relative cursor-help">Lỗi</span>}
                        {item.status === 'pending' && <span className="text-gray-400 text-[10px]">Chờ</span>}
                        {item.status === 'skipped' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">Có sẵn</span>}
                    </td>
                    </tr>
                );
              })}
              {currentData.length === 0 && (
                <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        {filterTerm ? 'Không tìm thấy kết quả phù hợp.' : 'Không có dữ liệu hiển thị.'}
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-xs text-gray-500">
                    <b>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</b>-<b>{Math.min(currentPage * ITEMS_PER_PAGE, visibleResults.length)}</b> / <b>{visibleResults.length}</b>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    
                    <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
                        <input 
                            type="text" 
                            inputMode="numeric"
                            value={pageInput}
                            onChange={(e) => setPageInput(e.target.value)}
                            onBlur={handlePageInputSubmit}
                            className="w-8 text-center p-1 text-xs border border-gray-300 rounded focus:border-blue-500 outline-none bg-white shadow-sm"
                        />
                        <span className="text-xs text-gray-500">/ {totalPages}</span>
                    </form>

                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ResultTable;