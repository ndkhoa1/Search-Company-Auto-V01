import { GoogleGenAI } from "@google/genai";
import { CompanyData, Source } from "../types";

// Khởi tạo SDK Client-side
// Lưu ý: process.env.API_KEY được lấy từ môi trường (Google AI Studio hoặc file .env)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const searchCompanyInfo = async (companyName: string): Promise<CompanyData> => {
  let retries = 0;
  const maxRetries = 3;

  while (true) {
    try {
      const prompt = `
        Tìm "Mã số thuế" (Tax Code) và "Website/Domain" chính thức của công ty: "${companyName}" tại Việt Nam.
        
        Yêu cầu:
        - Ưu tiên nguồn: Tổng cục thuế, Masothue, Hosocongty.
        - Domain: Phải là trang chủ chính thức (bỏ qua trang tuyển dụng, trang vàng). Chuyển về dạng @domain.com.
        
        Trả về ĐÚNG định dạng sau (không thêm lời dẫn):
        MST: [Mã số hoặc "Không tìm thấy"]
        DOMAIN: [Domain dạng @domain.com hoặc "Không tìm thấy"]
        TOMTAT: [Mô tả ngành nghề ngắn gọn dưới 20 từ]
      `;

      // Sử dụng gemini-3-flash-preview như cấu hình ổn định ban đầu
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || "Không tìm thấy thông tin.";
      
      // Trích xuất sources
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: Source[] = groundingChunks
        .map((chunk) => {
          if (chunk.web) {
            return { title: chunk.web.title || "Nguồn tham khảo", uri: chunk.web.uri };
          }
          return null;
        })
        .filter((item): item is Source => item !== null);

      // --- Logic xử lý kết quả (Parsing) ---
      
      // Regex extraction
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
      
      const isQuotaError = msg.includes("429") || msg.includes("503") || msg.includes("quota") || msg.includes("overloaded");

      if (isQuotaError && retries < maxRetries) {
        retries++;
        const delay = 2000 * Math.pow(2, retries - 1);
        console.warn(`API Busy. Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
        await wait(delay);
        continue;
      }
      
      console.error("Search Service Error:", error);
      throw new Error(error.message || "Lỗi tìm kiếm.");
    }
  }
};