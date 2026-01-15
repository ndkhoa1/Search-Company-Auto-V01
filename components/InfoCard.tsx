import React from 'react';
import { CompanyData } from '../types';
import ReactMarkdown from 'react-markdown';

interface InfoCardProps {
  data: CompanyData;
}

const InfoCard: React.FC<InfoCardProps> = ({ data }) => {
  const isDomainFound = data.domain && data.domain.toLowerCase() !== 'không tìm thấy';
  
  return (
    <div className="w-full max-w-4xl mx-auto mt-8 animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Kết quả tra cứu
          </h2>
          <p className="text-blue-100 text-sm mt-1 opacity-90">
            Dữ liệu được tổng hợp từ internet
          </p>
        </div>

        <div className="p-8">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Tax Code Box */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-300 group">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 group-hover:text-blue-600 transition-colors">
                Mã Số Thuế (MST)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-mono font-bold text-slate-800 select-all">
                  {data.taxCode}
                </span>
                <button 
                  onClick={() => navigator.clipboard.writeText(data.taxCode)}
                  className="p-1.5 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
                  title="Sao chép MST"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
              </div>
            </div>

            {/* Domain Box */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-300 group">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 group-hover:text-blue-600 transition-colors">
                Website Domain
              </span>
              {isDomainFound ? (
                <a 
                  href={`https://${data.domain}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-2xl font-bold text-blue-600 hover:text-blue-800 hover:underline decoration-2 underline-offset-4 transition-all truncate max-w-full px-2"
                >
                  {data.domain}
                </a>
              ) : (
                <span className="text-xl font-medium text-slate-400 italic">
                  Chưa xác định
                </span>
              )}
            </div>
          </div>

          {/* AI Summary Section */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Chi tiết doanh nghiệp
            </h3>
            <div className="bg-indigo-50/50 rounded-lg p-6 text-slate-700 leading-relaxed border border-indigo-50 prose prose-sm max-w-none">
               <ReactMarkdown>{data.summary}</ReactMarkdown>
            </div>
          </div>

          {/* Sources Section */}
          {data.sources.length > 0 && (
            <div className="border-t border-gray-100 pt-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                Nguồn tin xác thực (Sources)
              </h4>
              <ul className="space-y-2">
                {data.sources.map((source, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm group">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <a 
                      href={source.uri} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-slate-600 hover:text-blue-600 transition-colors line-clamp-1 hover:underline decoration-blue-200 underline-offset-2"
                    >
                      {source.title} <span className="text-slate-300 text-xs ml-1">({new URL(source.uri).hostname})</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InfoCard;
