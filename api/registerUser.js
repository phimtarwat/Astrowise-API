// api/registerUser.js
import crypto from "crypto";
import { updateUser } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  try {
    // ✅ 1) บังคับใช้ POST เท่านั้น
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "❌ Method not allowed",
      });
    }

    // ✅ 2) gen user_id + token แบบสุ่ม
    const user_id = Date.now().toString().slice(-6); // ตัวเลข 6 หลักท้าย
    const token = crypto.randomBytes(3).toString("hex"); // token สั้น ๆ เช่น "a3f9c2"

    // ✅ 3) ค่า default (quota=0, package=null, expiry=null)
    const payload = {
      userId: user_id,
      token: token,
      quota: 0,
      packageName: null,
      expiry: null,
      payment_intent_id: null,
      receipt_url: null,
      paid_at: null,
    };

    // ✅ 4) เขียนข้อมูลลง Google Sheet
    const ok = await updateUser(payload);
    if (!ok) {
      return res.status(500).json({
        success: false,
        message: "❌ บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่",
      });
    }

    // ✅ 5) ตอบกลับตาม spec
    return res.json({
      success: true,
      message: "✅ สมัครสมาชิกสำเร็จแล้วค่ะ",
      user_id,
      token,
      quota: 0,
      package: null,
      expiry: null,
    });
  } catch (err) {
    console.error("❌ registerUser fatal error:", err.message);
    return res.status(500).json({
      success: false,
      message: "❌ ระบบขัดข้อง กรุณาลองใหม่ภายหลัง",
    });
  }
}
