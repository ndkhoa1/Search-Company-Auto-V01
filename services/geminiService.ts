import { CompanyData, Source } from "../types";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const searchCompanyInfo = async (companyName: string): Promise<CompanyData> => {
  let retries = 0;
  const maxRetries = 3;

  while (true) {
    try {
      // Gọi đến Backend của chính mình (Vercel Function) thay vì gọi Google trực tiếp
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const { text, sources } = await response.json();

      // --- Logic xử lý kết quả (Parsing) giữ nguyên ở Frontend ---
      
      // Regex extraction
      const mstMatch = text.match(/MST:\s*([0-9-]+)/i) || text.match(/(?:Mã số thuế|MST)[:\s]+([0-9-]+)/i);
      const domainMatch = text.match(/DOMAIN:\s*(@?[\w.-]+\.[\w]+)/i) || text.match(/(?:Website|Domain)[:\s]+((?:https?:\/\/)?[\w.-]+\.[\w]+)/i);
      
      let cleanDomain = domainMatch ? domainMatch[1].trim() : "Không tìm thấy";
      
      // Format domain to start with @ if it looks like a domain
      if (cleanDomain !== "Không tìm thấy") {
          // Remove http/https/www
          cleanDomain = cleanDomain.replace(/^(https?:\/\/)?(www\.)?/, '');
          // Remove trailing slashes
          cleanDomain = cleanDomain.replace(/\/$/, '');
          // Ensure it starts with @
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
        sources: sources || [],
      };

    } catch (error: any) {
      const msg = error.message?.toLowerCase() || "";
      
      // 429 = Too Many Requests, 503 = Service Unavailable, 504 = Gateway Timeout
      const isQuotaError = msg.includes("quota") || msg.includes("429") || msg.includes("504") || msg.includes("limit");

      if (isQuotaError && retries < maxRetries) {
        retries++;
        // Exponential backoff: 2s, 4s, 8s...
        const delay = 2000 * Math.pow(2, retries - 1);
        console.warn(`API Error/Quota hit. Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
        await wait(delay);
        continue; // Retry the loop
      }
      
      console.error("Search Service Error:", error);
      
      if (isQuotaError) {
          throw new Error("Hệ thống đang bận hoặc quá tải. Vui lòng thử lại sau.");
      }

      throw new Error(error.message || "Lỗi tìm kiếm.");
    }
  }
};