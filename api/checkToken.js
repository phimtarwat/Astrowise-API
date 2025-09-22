// api/checkToken.js
import { findUser } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  const { user_id, token, mode } = req.query;

  if (!user_id || !token) {
    return res.status(400).json({ error: "missing user_id or token" });
  }

  // ✅ ต้องมี mode=check ตามที่ core กำหนด
  if (mode !== "check") {
    return res.status(400).json({
      error: "invalid_mode",
      message: "ต้องใส่ค่า mode=check"
    });
  }

  const user = await findUser(user_id, token);

  if (!user) {
    return res.status(401).json({
      status: "invalid",
      message: "❌ สิทธิ์หมดหรือไม่พบผู้ใช้",
      packages: {
        lite: "👉 [ชำระเงินที่นี่](https://buy.stripe.com/test_5kQ7sM1uJbz5fOW6Nr7Re00)",
        standard: "👉 [ชำระเงินที่นี่](https://buy.stripe.com/test_28E5kEgpD9qX0U23Bf7Re01)",
        premium: "👉 [ชำระเงินที่นี่](https://buy.stripe.com/test_3cI3cwddrdHdgT01t77Re02)"
      }
    });
  }

  // ถ้าเจอ user → return quota
  return res.json({
    status: "valid",
    message: "✅ ใช้งานได้",
    remaining: user.quota,
    package: user.package || "unknown"
  });
}
