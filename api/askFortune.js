// api/askFortune.js
import { findUser, updateQuota } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  const { user_id, token, question } = req.body;

  if (!user_id || !token) {
    return res.status(400).json({ error: "missing user_id or token" });
  }

  const user = await findUser(user_id, token);
  if (!user || user.quota <= 0) {
    return res.status(401).json({
      error: "no_quota",
      message: "❌ สิทธิ์หมดแล้ว กรุณาซื้อแพ็กเกจใหม่ค่ะ"
    });
  }

  const newQuota = user.quota - 1;
  await updateQuota(user_id, token, newQuota);

  // TODO: เรียก core astrology ที่นี่
  const fortune = `🔮 คำทำนายสำหรับ "${question}" (Demo result)`;

  return res.json({
    success: true,
    quota: newQuota,
    fortune,
  });
}

