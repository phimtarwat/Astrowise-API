// api/checkToken.js
import { findUser } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  const { user_id, token, mode } = req.query;

  // ✅ ต้องมี user_id, token
  if (!user_id || !token) {
    return res.status(400).json({
      status: "error",
      message: "❌ ต้องส่ง user_id และ token มาด้วย",
    });
  }

  // ✅ ถ้า connector ไม่ส่ง mode=check → เราจะถือว่าเป็น check mode ให้เลย
  if (!mode || mode !== "check") {
    console.warn("⚠️ mode ไม่ถูกต้อง (req.query.mode =", mode, ") → บังคับให้เป็น check");
  }

  // 🔎 หา user ใน Google Sheet
  const user = await findUser(user_id, token);
  if (!user) {
    return res.status(401).json({
      status: "invalid",
      message: "❌ สิทธิ์หมดหรือไม่พบผู้ใช้",
      packages: {
        lite: "👉 [ซื้อ Lite (5 ครั้ง)](https://your-stripe-lite-link)",
        standard: "👉 [ซื้อ Standard (10 ครั้ง)](https://your-stripe-standard-link)",
        premium: "👉 [ซื้อ Premium (30 ครั้ง)](https://your-stripe-premium-link)",
      },
    });
  }

  // 📌 ตรวจ expiry
  const today = new Date().toISOString().slice(0, 10);
  if (user.expiry && today > user.expiry) {
    return res.status(401).json({
      status: "expired",
      message: "❌ สิทธิ์ของคุณหมดอายุแล้ว กรุณาซื้อแพ็กเกจใหม่ค่ะ",
    });
  }

  // 📌 ตรวจ quota
  if (user.quota <= 0) {
    return res.status(401).json({
      status: "no_quota",
      message: "❌ สิทธิ์หมดแล้ว กรุณาซื้อแพ็กเกจใหม่ค่ะ",
    });
  }

  // ✅ ใช้งานได้
  return res.json({
    status: "valid",
    message: "✅ ใช้งานได้",
    remaining: user.quota,
    package: user.package || "unknown",
    expiry: user.expiry,
  });
}
