import React, { useState } from 'react';

interface BulkSearchFormProps {
  onSearch: (terms: string[], rawSheetRows?: string[][]) => void;
  isProcessing: boolean;
}

type InputMode = 'manual' | 'sheet';

const BulkSearchForm: React.FC<BulkSearchFormProps> = ({ onSearch, isProcessing }) => {
  const [mode, setMode] = useState<InputMode>('sheet');
  const [textInput, setTextInput] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const getSheetId = (url: string) => {
    const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return matches ? matches[1] : null;
  };

  const getSheetGid = (url: string) => {
    const matches = url.match(/[?&#]gid=([0-9]+)/);
    return matches ? matches[1] : null;
  };

  const parseCSVLine = (line: string): string[] => {
    const result = [];
    let start = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            result.push(line.substring(start, i));
            start = i + 1;
        }
    }
    result.push(line.substring(start));
    return result.map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
  };

  const fetchWithTimeout = async (url: string, timeout = 30000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  const smartFetchSheet = async (sheetId: string, gid: string | null): Promise<string> => {
    const strategies = [
        {
            name: 'Export API (CorsProxy)',
            url: `https://corsproxy.io/?${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`)}`
        },
        {
            name: 'Google Viz API (CorsProxy)',
            url: `https://corsproxy.io/?${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`)}`
        },
        {
             name: 'Export API (CodeTabs)',
             url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`)}`
        },
        {
             name: 'Export API (AllOrigins)',
             url: `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`)}`
        }
    ];

    let lastError = new Error('Unknown error');

    for (const strategy of strategies) {
        try {
            console.log(`Trying strategy: ${strategy.name}...`);
            const response = await fetchWithTimeout(strategy.url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const text = await response.text();

            if (!text || text.trim().length === 0) {
                throw new Error('Empty response');
            }
            if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
                throw new Error('Received HTML instead of CSV (Auth or Proxy Error)');
            }
            if (text.includes('google.com/accounts')) {
                throw new Error('Google Auth Redirect (File not public)');
            }

            console.log(`Success with strategy: ${strategy.name}`);
            return text;

        } catch (e: any) {
            console.warn(`Failed strategy ${strategy.name}: ${e.message}`);
            lastError = e;
        }
    }

    throw lastError;
  };

  const fetchAndParseSheet = async (url: string): Promise<string[][]> => {
    const sheetId = getSheetId(url);
    const gid = getSheetGid(url);

    if (!sheetId) {
      throw new Error('Link Google Sheet không hợp lệ. Vui lòng kiểm tra lại URL.');
    }

    try {
        const csvText = await smartFetchSheet(sheetId, gid);
        const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
        return lines.map(parseCSVLine);
    } catch (error: any) {
        let msg = 'Không thể tải dữ liệu.';
        if (error.message.includes('Google Auth')) {
            msg = 'Link chưa được chia sẻ Công khai (Anyone with the link).';
        } else if (error.message.includes('HTML')) {
             msg = 'Lỗi Proxy trung gian. Vui lòng thử lại sau vài giây.';
        } else if (error.name === 'AbortError') {
             msg = 'Hết thời gian chờ (Timeout). File quá lớn hoặc mạng chậm.';
        } else {
             msg = `Lỗi kết nối: ${error.message}. Kiểm tra quyền truy cập của File.`;
        }
        throw new Error(msg);
    }
  };

  const validateHeaders = (rows: string[][]) => {
    if (rows.length < 1) throw new Error('File Sheet rỗng.');
    const headerCount = rows[0].length;
    if (headerCount < 4) {
        console.warn(`Sheet có ${headerCount} cột. Cần ít nhất 4 cột để đọc dữ liệu ở cột D.`);
    }
  };

  const cleanSheetRows = (rows: string[][]): string[][] => {
    if (rows.length < 2) return rows;
    const header = rows[0];
    const dataRows = rows.slice(1).filter(r => r[3] && r[3].trim().length > 0);
    return [header, ...dataRows];
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportStatus(null);
    
    const terms = textInput.split(/\n/).map(s => s.trim()).filter(s => s.length > 0);
    const uniqueTerms = Array.from(new Set(terms));

    if (uniqueTerms.length === 0) return;

    let sheetData: string[][] | undefined = undefined;

    if (sheetUrl.trim()) {
        try {
            setImportStatus({ type: 'info', message: 'Đang kết nối tới Sheet mẫu...' });
            let rows = await fetchAndParseSheet(sheetUrl);
            validateHeaders(rows);
            rows = cleanSheetRows(rows);
            sheetData = rows.map(r => {
                const padded = [...r];
                while (padded.length < 6) padded.push('');
                return padded;
            });
            setImportStatus({ type: 'success', message: 'Đã kết nối Sheet thành công.' });
        } catch (error: any) {
            setImportStatus({ type: 'error', message: error.message });
            return;
        }
    }

    onSearch(uniqueTerms, sheetData);
  };

  const handleSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportStatus({ type: 'info', message: 'Đang tải và phân tích dữ liệu...' });

    try {
      let rows = await fetchAndParseSheet(sheetUrl);
      validateHeaders(rows);
      rows = cleanSheetRows(rows);

      const companies: string[] = [];
      for (let i = 1; i < rows.length; i++) {
          if (rows[i].length > 3 && rows[i][3]) {
             const val = rows[i][3].trim();
             if (val) companies.push(val);
          }
      }

      if (companies.length === 0) {
        const rowCount = rows.length;
        throw new Error(
            `Không tìm thấy dữ liệu tại Cột D (Tên công ty) sau khi lọc dòng trống.\n` + 
            `- Số dòng hợp lệ: ${rowCount - 1}\n` + 
            `- Tab ID (gid): ${getSheetGid(sheetUrl) || 'Mặc định (0)'}`
        );
      }

      const uniqueCompanies = Array.from(new Set(companies));
      const paddedRows = rows.map(r => {
          const padded = [...r];
          while (padded.length < 6) padded.push('');
          return padded;
      });

      setImportStatus({ type: 'success', message: `Đã tìm thấy ${uniqueCompanies.length} công ty.` });
      onSearch(uniqueCompanies, paddedRows);

    } catch (error: any) {
      setImportStatus({ type: 'error', message: error.message });
    }
  };

  return (
    <div className="w-full animate-fade-in">
      <div className="flex border-b border-gray-200 mb-4">
        <button
          className={`py-2 px-4 text-xs font-medium transition-colors border-b-2 flex-1 ${
            mode === 'sheet' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => { setMode('sheet'); setImportStatus(null); }}
          disabled={isProcessing}
        >
          Từ Link Sheet
        </button>
        <button
          className={`py-2 px-4 text-xs font-medium transition-colors border-b-2 flex-1 ${
            mode === 'manual' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => { setMode('manual'); setImportStatus(null); }}
          disabled={isProcessing}
        >
          Thủ công
        </button>
      </div>

      <div className="">
        {mode === 'sheet' && (
          <form onSubmit={handleSheetSubmit} className="space-y-3">
            <div>
                <label htmlFor="sheet-url-mode" className="block text-xs font-semibold text-gray-700 mb-1">
                    Link Google Sheet
                </label>
                <div className="flex flex-col gap-2">
                    <input 
                        id="sheet-url-mode"
                        type="url" 
                        placeholder="https://docs.google.com/spreadsheets/d/..." 
                        className="w-full p-2.5 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        value={sheetUrl}
                        onChange={(e) => setSheetUrl(e.target.value)}
                        disabled={isProcessing}
                        required
                    />
                    <button
                        type="submit"
                        disabled={isProcessing || !sheetUrl.trim()}
                        className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-medium text-sm rounded-lg shadow-sm transition-all disabled:opacity-50"
                    >
                        {isProcessing ? 'Đang xử lý...' : 'Quét Sheet'}
                    </button>
                </div>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100 text-[11px] text-blue-800 leading-relaxed">
                    <p className="font-bold mb-1">Lưu ý:</p>
                    <ul className="list-disc pl-3 space-y-1">
                        <li>File phải để chế độ <b>"Anyone with the link"</b>.</li>
                        <li>Đọc tên công ty từ <b>Cột D</b>.</li>
                        <li>Kết quả ghi vào <b>Cột E (Domain)</b> & <b>F (MST)</b>.</li>
                    </ul>
                </div>
            </div>
          </form>
        )}

        {mode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div>
                 <label htmlFor="company-list" className="block text-xs font-semibold text-gray-700 mb-1">
                  Danh sách công ty
                </label>
                <textarea
                  id="company-list"
                  rows={6}
                  className="block w-full p-3 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  placeholder={"Vinamilk\nFPT\n..."}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  disabled={isProcessing}
                  required
                />
            </div>
            
            <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Link Sheet mẫu (Tùy chọn)
                </label>
                <input 
                    type="url" 
                    placeholder="https://docs.google.com/..." 
                    className="w-full p-2.5 text-sm bg-gray-50 rounded-lg border border-gray-300 focus:border-blue-500 outline-none"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    disabled={isProcessing}
                />
            </div>

            <button
                type="submit"
                disabled={isProcessing || !textInput.trim()}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-all disabled:opacity-50 mt-2"
            >
                {isProcessing ? 'Đang xử lý...' : `Tìm kiếm (${textInput.split(/\n/).filter(s => s.trim()).length})`}
            </button>
          </form>
        )}

        {importStatus && (
            <div className={`mt-3 p-3 rounded-lg text-xs flex items-start gap-2 ${
                importStatus.type === 'error' ? 'bg-red-50 text-red-700' :
                importStatus.type === 'success' ? 'bg-green-50 text-green-700' :
                'bg-blue-50 text-blue-700'
            }`}>
                {importStatus.type === 'info' && <svg className="animate-spin w-3 h-3 flex-shrink-0 mt-0.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                <span className="break-words">{importStatus.message}</span>
            </div>
        )}
      </div>
    </div>
  );
};

export default BulkSearchForm;