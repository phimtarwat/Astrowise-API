// lib/astrologyCore.js
import fs from "fs";
import path from "path";

// โหลดเนื้อหาจากไฟล์ markdown core
const corePath = path.join(process.cwd(), "astrology-core-v.1.3.md");
let coreText = "";

// โหลดไฟล์ตอน start
try {
  coreText = fs.readFileSync(corePath, "utf8");
  console.log("✅ astrology core loaded:", corePath);
} catch (err) {
  console.error("❌ Cannot load astrology core file:", err.message);
}

/**
 * ฟังก์ชันจำลองการทำนายจาก core
 * ในระบบจริงคุณสามารถ replace ด้วย LLM/Prompt ที่ใช้ core นี้เป็น context
 */
export async function getAstrologyPrediction(question) {
  if (!coreText) {
    return "❌ Core astrology data not available.";
  }

  // ตัวอย่างง่าย ๆ: เอาคำถามมา + extract คีย์เวิร์ด
  // (ในระบบจริงให้ใช้ OpenAI API หรือ LLM เชื่อมกับ coreText)
  const keywords = question.split(" ").slice(0, 3).join(" ");
  const demo = coreText.slice(0, 200); // ตัดมาโชว์ sample context

  return `🔮 คำทำนายสำหรับ "${question}"\n\n(อ้างอิงจาก core astrology)\n\n${demo}...`;
}
