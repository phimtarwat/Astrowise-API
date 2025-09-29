// api/registerUser.js
import { generateUserId, generateToken } from "../lib/token.js";
import { addUser } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  // ✅ 1) รับเฉพาะ POST เท่านั้น
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "❌ Method not allowed, ต้องใช้ POST เท่านั้น",
    });
  }

  try {
    // ✅ 2) สร้าง user_id + token
    const userId = generateUserId();   // เช่น u123456
    const token = generateToken();     // เช่น tabcdef
    const nowIso = new Date().toISOString();

    // ✅ 3) เตรียมข้อมูล default ของสมาชิกใหม่
    const userData = {
      user_id: userId,        // ใช้ snake_case ให้ตรงกับ spec
      token,
      quota: 0,
      used_count: 0,
      package: null,
      expiry: null,
      email: req.body?.email || null,
      created_at: nowIso,
      payment_intent_id: null,
      receipt_url: null,
      paid_at: null,
    };

    // ✅ 4) บันทึกลง Google Sheet
    let added = false;
    try {
      added = await addUser(userData);
    } catch (err) {
      console.error("❌ addUser threw error:", err.message);
    }

    if (!added) {
      console.error("❌ Failed to store user in Google Sheet:", userId);
      return res.status(500).json({
        success: false,
        message: "❌ สมัครไม่สำเร็จ (บันทึกข้อมูลไม่สำเร็จ)",
        user_id: userId,
        token,
      });
    }

    console.log("✅ User stored successfully in Google Sheet:", userId);

    // ✅ 5) ส่ง response กลับหาลูกค้า
    return res.status(200).json({
      success: true,
      message: "✅ สมัครสมาชิกสำเร็จ (ยังไม่มีสิทธิ์)",
      user_id: userId,
      token,
      quota: 0,
      package: null,
      expiry: null,
    });
  } catch (err) {
    console.error("❌ registerUser failed:", err.message);
    return res.status(500).json({
      success: false,
      message: "❌ ระบบไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง",
      error: err.message,
    });
  }
}
