// api/checkToken.js
import { findUser } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  try {
    // ✅ 1) บังคับใช้ GET เท่านั้น
    if (req.method !== "GET") {
      return res.status(405).json({
        status: "error",
        message: "❌ Method not allowed, ต้องใช้ GET เท่านั้น",
      });
    }

    // ✅ 2) รับค่าและ normalize
    const { user_id, token, mode } = req.query;
    const uid = String(user_id || "").trim();
    const tkn = String(token || "").trim();

    // ✅ 3) ต้องมี mode=check เท่านั้น
    if (mode !== "check") {
      return res.status(400).json({
        status: "error",
        message: "❌ ต้องระบุ mode=check เท่านั้น",
      });
    }

    // ✅ 4) ป้องกัน input แปลก ๆ
    const safeId = /^u[0-9]+$/.test(uid);          // user_id ต้องขึ้นต้นด้วย u + ตัวเลข
    const safeToken = /^[A-Za-z0-9_-]+$/.test(tkn); // token ต้องเป็น a-zA-Z0-9_- เท่านั้น

    if (!safeId || !safeToken) {
      return res.status(400).json({
        status: "error",
        message: "❌ user_id หรือ token ไม่ถูกต้อง",
      });
    }

    // ✅ 5) ค้นหา user ใน Google Sheet
    const user = await findUser(uid, tkn);
    if (!user) {
      return res.status(401).json({
        status: "invalid",
        message: "❌ ไม่พบข้อมูลสมาชิก หรือ token ไม่ถูกต้อง",
      });
    }

    // ✅ 6) ตรวจสอบ quota และ expiry
    const today = new Date();
    let isExpired = false;
    if (user.expiry) {
      const expDate = new Date(user.expiry);
      if (today > expDate) {
        isExpired = true;
      }
    }

    if (isExpired) {
      return res.status(401).json({
        status: "expired",
        message: "❌ สิทธิ์หมดอายุแล้ว",
      });
    }

    if (user.quota <= 0) {
      return res.status(200).json({
        status: "no_quota",
        packages: {
          lite: "👉 [ซื]()
