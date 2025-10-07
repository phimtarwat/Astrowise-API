// lib/astrologyCoreAI.js
import fs from "fs";
import path from "path";
import OpenAI from "openai";

// ✅ โหลด API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ โหลด core file (markdown)
const corePath = path.join(process.cwd(), "astrology-core-v.1.3.md");
let coreText = "";

try {
  if (fs.existsSync(corePath)) {
    coreText = fs.readFileSync(corePath, "utf8");
    console.log("✅ astrology core loaded:", corePath);
  } else {
    console.warn("⚠️ Core file not found:", corePath);
  }
} catch (err) {
  console.error("❌ Error reading core file:", err.message);
}

/**
 * ฟังก์ชันทำนายดวงด้วย AI
 * - question: คำถามจากผู้ใช้
 * - ใช้ coreText เป็น context
 */
export async function getAstrologyPrediction(question) {
  if (!coreText) {
    return "❌ ข้อมูล core astrology ยังไม่พร้อมใช้งานครับ";
  }

  // 🔹 Prompt ที่ส่งไปให้โมเดล
  const prompt = `
คุณคือโหราจารย์ผู้เชี่ยวชาญในศาสตร์ดวงชะตา
ใช้ข้อมูลต่อไปนี้เป็นฐานความรู้หลักในการตอบ:
---
${coreText.slice(0, 8000)}  // จำกัด context ป้องกัน input ใหญ่เกินไป
---
คำถามจากผู้ใช้: "${question}"

กรุณาตอบเป็นภาษาไทย ให้เนื้อหาชัดเจน กระชับ
เพิ่มคำแนะนำปฏิบัติเล็กน้อยถ้าเหมาะสม
`;

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",   // หรือ gpt-4.1 ได้ถ้าคุณเปิดสิทธิ์
      messages: [
        { role: "system", content: "คุณคือโหราจารย์ AI" },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    return resp.choices[0].message.content.trim();
  } catch (err) {
    console.error("❌ Error from OpenAI:", err.message);
    return "❌ ไม่สามารถสร้างคำทำนายได้ในขณะนี้ กรุณาลองใหม่ภายหลัง";
  }
}
