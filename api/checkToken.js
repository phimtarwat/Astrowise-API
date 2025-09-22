// api/checkToken.js
import { findUser } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  const { user_id, token } = req.query;

  if (!user_id || !token) {
    return res.status(400).json({ error: "missing user_id or token" });
  }

  const user = await findUser(user_id, token);

  if (!user) {
    return res.status(401).json({
      error: "invalid_token",
      message: "❌ สิทธิ์หมดหรือไม่พบผู้ใช้ กรุณาซื้อแพ็กเกจใหม่ค่ะ",
      packages: {
        lite: "👉 [ชำระเงินที่นี่](https://buy.stripe.com/test_5kQ7sM1uJbz5fOW6Nr7Re00)",
        standard: "👉 [ชำระเงินที่นี่](https://buy.stripe.com/test_28E5kEgpD9qX0U23Bf7Re01)",
        premium: "👉 [ชำระเงินที่นี่](https://buy.stripe.com/test_3cI3cwddrdHdgT01t77Re02)"
      }
    });
  }

  return res.json({
    valid: true,
    quota: user.quota,
  });
}

