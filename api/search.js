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

    // Tối ưu prompt ngắn gọn để AI trả lời nhanh hơn
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

    // Sử dụng gemini-2.5-flash để cân bằng giữa tốc độ và khả năng search
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        maxOutputTokens: 200, // Giới hạn token đầu ra để phản hồi nhanh hơn
        temperature: 0.1, // Giảm sáng tạo để tăng độ chính xác thực tế
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