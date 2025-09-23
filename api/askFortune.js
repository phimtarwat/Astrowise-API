// api/askFortune.js
import { findUser, updateUsage } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  const { user_id, token, question } = req.body;

  if (!user_id || !token) {
    return res.status(400).json({ error: "missing user_id or token" });
  }

  // 🔎 ตรวจสอบ user
  const user = await findUser(user_id, token);
  if (!user) {
    return res.status(401).json({
      error: "invalid_token",
      message: "❌ ไม่พบผู้ใช้ กรุณาซื้อแพ็กเกจใหม่ค่ะ",
    });
  }

  // 🔎 ตรวจสอบ expiry
  const today = new Date().toISOString().slice(0, 10);
  if (user.expiry && today > user.expiry) {
    return res.status(401).json({
      error: "expired",
      message: "❌ สิทธิ์ของคุณหมดอายุแล้ว (30 วัน) กรุณาซื้อแพ็กเกจใหม่ค่ะ",
    });
  }

  // 🔎 ตรวจสอบ quota
  if (user.quota <= 0) {
    return res.status(401).json({
      error: "no_quota",
      message: "❌ สิทธิ์หมดแล้ว กรุณาซื้อแพ็กเกจใหม่ค่ะ",
    });
  }

  // ✅ หัก quota + บันทึก used_count
  const newQuota = user.quota - 1;
  await updateUsage(user_id, token, newQuota);

  // ⚠️ แจ้งเตือนถ้าใกล้หมดสิทธิ์
  let warning = "";
  if (newQuota < 5) {
    warning = `⚠️ เหลือสิทธิ์อีกเพียง ${newQuota} ครั้ง อย่าลืมต่ออายุก่อนหมดสิทธิ์นะคะ`;
  }

  // TODO: เรียก core astrology ที่นี่
  const fortune = `🔮 คำทำนายสำหรับ "${question}" (Demo result)`;

  return res.json({
    success: true,
    remaining: newQuota,
    answer: fortune,
    warning,
  });
}
