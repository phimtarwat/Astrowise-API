// api/checkToken.js
import { findUser } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  const { user_id, token, mode } = req.query;

  // ✅ ต้องมี mode=check เท่านั้น
  if (mode !== "check") {
    return res.status(400).json({
      status: "error",
      message: "❌ ต้องระบุ mode=check เท่านั้น",
    });
  }

  const user = await findUser(user_id, token);
  if (!user) {
    return res.status(401).json({
      status: "invalid",
      message: "❌ user_id หรือ token ไม่ถูกต้อง",
    });
  }

  // ✅ quota/แพ็กเกจหมด
  if (!user.package || user.quota <= 0) {
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

  // ✅ ใช้งานได้
  return res.json({
    status: "valid",
    message: "✅ ใช้งานได้",
    remaining: user.quota - user.used_count,
    package: user.package,
    expiry: user.expiry,
  });
}
