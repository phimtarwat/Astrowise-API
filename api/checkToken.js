// api/checkToken.js
import { findUser } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  try {
    // ✅ 1) บังคับใช้ GET เท่านั้น
    if (req.method !== "GET") {
      return res.status(405).json({
        status: "error",
        message: "❌ Method not allowed",
      });
    }

    // ✅ 2) รับค่าและ normalize
    const { user_id, token, mode } = req.query;
    const uid = String(user_id || "").trim();
    const tkn = String(token || "").trim();

    // ✅ 3) ต้องมี mode=check
    if (mode !== "check") {
      return res.status(400).json({
        status: "error",
        message: "❌ ต้องระบุ mode=check เท่านั้น",
      });
    }

    // ✅ 4) ป้องกัน input แปลก ๆ (เช่น script injection)
    const safeId = /^[0-9]+$/.test(uid);
    const safeToken = /^[A-Za-z0-9_-]+$/.test(tkn);
    if (!safeId || !safeToken) {
      return res.status(400).json({
        status: "error",
        message: "❌ รูปแบบ user_id หรือ token ไม่ถูกต้อง",
      });
    }

    // ✅ 5) หา user
    const user = await findUser(uid, tkn);
    if (!user) {
      return res.status(401).json({
        status: "invalid",
        message: "❌ user_id หรือ token ไม่ถูกต้อง",
      });
    }

    // ✅ 6) ตรวจวันหมดอายุ
    if (user.expiry && new Date(user.expiry) < new Date()) {
      return res.status(401).json({
        status: "expired",
        message: "❌ token ของคุณหมดอายุแล้ว กรุณาซื้อแพ็กเกจใหม่",
        packages: {
          lite: "👉 Lite (5 ครั้ง): [ชำระเงินที่นี่](https://buy.stripe.com/test_5kQ7sM1uJbz5fOW6Nr7Re00)",
          standard: "👉 Standard (10 ครั้ง): [ชำระเงินที่นี่](https://buy.stripe.com/test_28E5kEgpD9qX0U23Bf7Re01)",
          premium: "👉 Premium (30 ครั้ง): [ชำระเงินที่นี่](https://buy.stripe.com/test_3cI3cwddrdHdgT01t77Re02)",
        },
      });
    }

    // ✅ 7) ตรวจ quota
    const remaining = Math.max(0, user.quota - user.used_count);
    if (!user.package || remaining <= 0) {
      return res.status(401).json({
        status: "no_quota",
        message: "❌ สิทธิ์ของคุณหมด หรือยังไม่ได้ซื้อแพ็กเกจ",
        packages: {
          lite: "👉 Lite (5 ครั้ง): [ชำระเงินที่นี่](https://buy.stripe.com/test_5kQ7sM1uJbz5fOW6Nr7Re00)",
          standard: "👉 Standard (10 ครั้ง): [ชำระเงินที่นี่](https://buy.stripe.com/test_28E5kEgpD9qX0U23Bf7Re01)",
          premium: "👉 Premium (30 ครั้ง): [ชำระเงินที่นี่](https://buy.stripe.com/test_3cI3cwddrdHdgT01t77Re02)",
        },
      });
    }

    // ✅ 8) Success
    console.log("✅ checkToken success:", {
      user_id: user.user_id,
      package: user.package,
      remaining,
    });

    return res.json({
      status: "valid",
      message: "✅ ใช้งานได้",
      remaining,
      package: user.package,
      expiry: user.expiry,
    });
  } catch (err) {
    console.error("❌ checkToken fatal error:", err.message);
    return res.status(500).json({
      status: "error",
      message: "❌ ระบบขัดข้อง กรุณาลองใหม่ภายหลัง",
    });
  }
}
