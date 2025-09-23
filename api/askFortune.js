// api/askFortune.js
import { findUser, updateUsage } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  // ✅ รับค่าจาก body ก่อน ถ้าไม่มีลองใช้ query fallback
  const user_id = req.body?.user_id || req.query?.user_id;
  const token = req.body?.token || req.query?.token;
  const question = req.body?.question || req.query?.question;

  if (!user_id || !token) {
    return res.status(400).json({
      error: "missing_user_token",
      message: "❌ ต้องส่ง user_id และ token มาด้วย",
    });
  }

  // 🔎 หา user
  const user = await findUser(user_id, token);
  if (!user) {
    return res.status(401).json({
      error: "invalid_token",
      message: "❌ ไม่พบผู้ใช้ กรุณาซื้อแพ็กเกจใหม่ค่ะ",
    });
  }

  // 🔎 ตรวจ expiry
  const today = new Date().toISOString().slice(0, 10);
  if (user.expiry && today > user.expiry) {
    return res.status(401).json({
      error: "expired",
      message: "❌ สิทธิ์ของคุณหมดอายุแล้ว กรุณาซื้อแพ็กเกจใหม่ค่ะ",
    });
  }

  // 🔎 ตรวจ quota
  if (user.quota <= 0) {
    return res.status(401).json({
      error: "no_quota",
      message: "❌ สิทธิ์หมดแล้ว กรุณาซื้อแพ็กเกจใหม่ค่ะ",
    });
  }

  // ✅ หัก quota และบันทึก used_count (+1)
  const newQuota = user.quota - 1;
  const updated = await updateUsage(user_id, token, newQuota);

  if (!updated) {
    return res.status(500).json({
      error: "update_failed",
      message: "❌ ไม่สามารถอัปเดตสิทธิ์ในระบบได้",
    });
  }

  // ⚠️ เตือนถ้า quota ใกล้หมด
  let warning = "";
  if (newQuota < 5) {
    warning = `⚠️ เหลือสิทธิ์อีกเพียง ${newQuota} ครั้ง อย่าลืมต่ออายุก่อนหมดสิทธิ์นะคะ`;
  }

  // TODO: เรียก core astrology API ที่นี่
  const fortune = `🔮 คำทำนายสำหรับ "${question || "คำถามที่ยังไม่ได้ระบุ"}" (Demo result)`;

  return res.json({
    success: true,
    remaining: newQuota,
    used: user.used_count + 1,
    answer: fortune,
    warning,
  });
}
