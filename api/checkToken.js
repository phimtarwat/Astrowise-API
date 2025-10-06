// api/checkToken.js
import { findUser } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      status: "error",
      message: "❌ ต้องใช้ GET หรือ POST เท่านั้น",
    });
  }

  const { user_id, token, mode } =
    req.method === "GET" ? req.query : req.body || {};

  if (!user_id || !token) {
    return res.status(400).json({
      status: "error",
      message: "❌ ต้องส่ง user_id และ token",
    });
  }

  if (mode !== "check") {
    return res.status(400).json({
      status: "error",
      message: "❌ ต้องระบุ mode=check",
    });
  }

  const user = await findUser(user_id, token);
  if (!user) {
    return res.status(401).json({
      status: "invalid",
      message: "❌ user_id หรือ token ไม่ถูกต้อง",
    });
  }

  if (user.expiry && new Date() > new Date(user.expiry)) {
    return res.status(401).json({
      status: "expired",
      message: "❌ สิทธิ์หมดอายุแล้ว",
    });
  }

  // ✅ เพิ่มกรณี no_package
  if (!user.package) {
    return res.status(200).json({
      status: "no_package",
      message: "❌ ยังไม่ได้ซื้อแพ็กเกจ",
      packages: {
        lite: "👉 [ซื้อ Lite](https://...)",
        standard: "👉 [ซื้อ Standard](https://...)",
        premium: "👉 [ซื้อ Premium](https://...)",
      },
    });
  }

  if (user.quota <= 0) {
    return res.status(200).json({
      status: "no_quota",
      packages: {
        lite: "👉 [ซื้อ Lite](https://...)",
        standard: "👉 [ซื้อ Standard](https://...)",
        premium: "👉 [ซื้อ Premium](https://...)",
      },
    });
  }

  return res.status(200).json({
    status: "valid",
    remaining: user.quota,
    package: user.package,
    expiry: user.expiry,
  });
}
