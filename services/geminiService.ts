import { CompanyData, Source } from "../types";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const searchCompanyInfo = async (companyName: string): Promise<CompanyData> => {
  let retries = 0;
  const maxRetries = 3;

  while (true) {
    try {
      // Gọi tới Serverless Function của Vercel thay vì gọi trực tiếp Google SDK
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Nếu lỗi 504 (Timeout) hoặc 429 (Too Many Requests), ném lỗi để retry
        if (response.status === 504 || response.status === 429) {
             throw new Error("Server overloaded or timed out");
        }
        throw new Error(errorData.error || `Lỗi server: ${response.status}`);
      }

      const data = await response.json();
      const text = data.text || "Không tìm thấy thông tin.";
      const sources: Source[] = data.sources || [];

      // --- Logic xử lý kết quả (Parsing) ---
      // Regex extraction (Phân tích cú pháp text trả về từ Server)
      const mstMatch = text.match(/MST:\s*([0-9-]+)/i) || text.match(/(?:Mã số thuế|MST)[:\s]+([0-9-]+)/i);
      const domainMatch = text.match(/DOMAIN:\s*(@?[\w.-]+\.[\w]+)/i) || text.match(/(?:Website|Domain)[:\s]+((?:https?:\/\/)?[\w.-]+\.[\w]+)/i);
      
      let cleanDomain = domainMatch ? domainMatch[1].trim() : "Không tìm thấy";
      
      // Format domain
      if (cleanDomain !== "Không tìm thấy") {
          cleanDomain = cleanDomain.replace(/^(https?:\/\/)?(www\.)?/, '');
          cleanDomain = cleanDomain.replace(/\/$/, '');
          if (!cleanDomain.startsWith('@')) {
              cleanDomain = `@${cleanDomain}`;
          }
      }

      const cleanTaxCode = mstMatch ? mstMatch[1].trim() : "Đang cập nhật";

      return {
        companyName: companyName, 
        taxCode: cleanTaxCode,
        domain: cleanDomain,
        summary: text,
        sources: sources,
      };

    } catch (error: any) {
      const msg = error.message?.toLowerCase() || "";
      const isQuotaError = msg.includes("overloaded") || msg.includes("timed out") || msg.includes("504") || msg.includes("429");

      if (isQuotaError && retries < maxRetries) {
        retries++;
        const delay = 2000 * Math.pow(2, retries - 1);
        // console.warn(`API Busy. Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
        await wait(delay);
        continue;
      }
      
      console.error("Search Service Error:", error);
      throw new Error(error.message || "Lỗi tìm kiếm.");
    }
  }
};