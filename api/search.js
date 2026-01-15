import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // Chỉ chấp nhận method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { companyName } = req.body;

    if (!process.env.API_KEY) {
      return res.status(500).json({ error: 'Server configuration error: API_KEY is missing' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
      Bạn là chuyên gia tra cứu thông tin doanh nghiệp.
      Hãy tìm "Mã số thuế" (Tax Code) và "Website/Domain" của công ty: "${companyName}".

      Yêu cầu bắt buộc:
      1. Tìm tại các nguồn uy tín (Tổng cục thuế, Masothue, Hosocongty...).
      2. Domain phải được chuyển về định dạng bắt đầu bằng @ (ví dụ: công ty ABC có web abc.com -> trả về @abc.com).
      3. Nếu có nhiều chi nhánh, chọn trụ sở chính.

      Định dạng trả về trong văn bản (cố gắng tuân thủ để dễ trích xuất):
      MST: [Mã số thuế tìm được]
      DOMAIN: [Domain dạng @domain.com hoặc "Không tìm thấy"]
      TOMTAT: [Mô tả ngắn 1 câu về ngành nghề]
    `;

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
    const sources = groundingChunks
      .map((chunk) => {
        if (chunk.web) {
          return { title: chunk.web.title, uri: chunk.web.uri };
        }
        return null;
      })
      .filter((item) => item !== null);

    return res.status(200).json({ text, sources });

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}