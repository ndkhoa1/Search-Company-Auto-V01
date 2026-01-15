import React, { useState } from 'react';

interface SearchBarProps {
  onSearch: (term: string) => void;
  isLoading: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading }) => {
  const [term, setTerm] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (term.trim()) {
      onSearch(term);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
          <svg className={`w-5 h-5 ${isLoading ? 'text-blue-500 animate-pulse' : 'text-gray-400 group-hover:text-blue-500'} transition-colors duration-300`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
          </svg>
        </div>
        <input 
          type="search" 
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          disabled={isLoading}
          className="block w-full p-4 pl-12 text-sm text-gray-900 border border-gray-200 rounded-full bg-white shadow-sm focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all duration-300 disabled:bg-gray-50 disabled:cursor-not-allowed placeholder-gray-400" 
          placeholder="Nhập tên công ty (ví dụ: Vinamilk, FPT, Viettel...)" 
          required 
        />
        <button 
          type="submit" 
          disabled={isLoading || !term.trim()}
          className="absolute right-2.5 bottom-2.5 bg-blue-600 hover:bg-blue-700 text-white focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-full text-sm px-6 py-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
        >
          {isLoading ? 'Đang tìm...' : 'Tìm kiếm'}
        </button>
      </form>
      <div className="mt-3 flex justify-center gap-4 text-xs text-gray-400">
        <span>✓ Tìm kiếm thời gian thực</span>
        <span>✓ Nguồn dữ liệu uy tín</span>
        <span>✓ Phân tích bởi Gemini AI</span>
      </div>
    </div>
  );
};

export default SearchBar;
