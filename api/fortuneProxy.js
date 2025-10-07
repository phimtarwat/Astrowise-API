// api/fortuneProxy.js
import { findUser, updateUsage } from "../lib/googleSheet.js";
import { getAstrologyPrediction } from "../lib/astrologyCoreAI.js"; // ✅ rename แล้ว
import { calcAstroChart } from "../lib/astrologyCoreCalc.js";       // ✅ ใช้ดึงข้อมูลดวงดาวจริง

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { user_id, token, question, birth } = req.body || {};

  // 🚨 ตรวจ input
  if (!user_id || !token || !question) {
    return res.status(400).json({
      error: "missing_fields",
      message: "❌ ต้องส่ง user_id, token และ question มาด้วย",
    });
  }

  // 🔎 ตรวจสอบ user
  const user = await findUser(user_id, token);
  if (!user) {
    return res.status(401).json({
      error: "invalid",
      message: "❌ ไม่พบ user_id/token ในระบบ กรุณาซื้อแพ็กเกจใหม่",
    });
  }

  // 📌 ตรวจ expiry
  const today = new Date().toISOString().slice(0, 10);
  if (user.expiry && today > user.expiry) {
    return res.status(401).json({
      error: "expired",
      message: "❌ สิทธิ์หมดอายุแล้ว กรุณาซื้อแพ็กเกจใหม่",
    });
  }

  // 🎟️ ตรวจ quota
  if (user.quota <= 0) {
    return res.status(401).json({
      error: "no_quota",
      message: "❌ สิทธิ์หมดแล้ว กรุณาซื้อแพ็กเกจใหม่",
    });
  }

  try {
    // 🪐 ถ้ามีข้อมูลวัน–เวลา–สถานที่เกิด → คำนวณดวงดาวจริง
    let astroData = null;
    if (birth && birth.date && birth.time && birth.lat && birth.lng && birth.zone) {
      console.log(`🪐 Calculating natal chart for ${birth.date} ${birth.time} (${birth.zone})`);
      astroData = await calcAstroChart(birth);
    }

    // ✨ ดึงคำทำนายจาก Core AI (ใช้ Markdown core)
    const fortune = await getAstrologyPrediction(question);
    console.log("🔮 fortune result:", fortune);

    // ✅ หัก quota หลังจากได้ผลลัพธ์
    const newQuota = user.quota - 1;
    const updated = await updateUsage(user_id, token, newQuota);

    if (!updated) {
      return res.status(500).json({
        error: "update_failed",
        message: "❌ ไม่สามารถอัปเดตสิทธิในฐานข้อมูลสมาชิกได้",
      });
    }

    let warning = "";
    if (newQuota < 3) {
      warning = `⚠️ เหลือสิทธิ์อีก ${newQuota} ครั้ง`;
    }

    // 📤 ส่ง response กลับ
    const responsePayload = {
      success: true,
      remaining: newQuota,
      used: user.used_count + 1,
      prediction: fortune,
      answer: fortune, // เผื่อ client เก่าที่ยังใช้ answer
      astroData,       // ✅ เพิ่มข้อมูลดวงดาวจริง
      warning,
    };

    console.log("📤 fortuneProxy response:", responsePayload);

    return res.json(responsePayload);
  } catch (err) {
    console.error("❌ Error generating fortune:", err);
    return res.status(500).json({
      error: "fortune_failed",
      message: "❌ ไม่สามารถให้คำทำนายได้ กรุณาลองใหม่",
    });
  }
}
