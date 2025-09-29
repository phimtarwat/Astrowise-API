// api/registerUser.js
import { generateUserId, generateToken } from "../lib/token.js";
import { addUser } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    // 🔹 gen user_id + token
    const userId = generateUserId();
    const token = generateToken();
    const nowIso = new Date().toISOString();

    console.log("👉 Registering new user:", { userId, token, email: req.body?.email });

    // 🔹 ค่า default สำหรับสมาชิกใหม่
    const userData = {
      userId,
      token,
      quota: 0,
      used_count: 0,
      packageName: null,
      expiry: null,
      email: req.body?.email || null,
      created_at: nowIso,
      payment_intent_id: null,
      receipt_url: null,
      paid_at: null
    };

    let added = false;
    try {
      // พยายามบันทึกลง Google Sheet
      added = await addUser(userData);
    } catch (err) {
      console.error("❌ addUser threw error:", err.message);
    }

    if (!added) {
      console.warn("⚠️ User was generated but not stored in Google Sheet:", userId);
    } else {
      console.log("✅ User stored successfully in Google Sheet:", userId);
    }

    // ✅ ส่ง response กลับหาลูกค้าเสมอ
    return res.status(200).json({
      success: true,
      message: "✅ สมัครสมาชิกสำเร็จ (ยังไม่มีสิทธิ์)",
      user_id: userId,
      token,
      quota: 0,
      package: null,
      expiry: null
    });
  } catch (err) {
    console.error("❌ registerUser failed:", err.message);
    return res.status(500).json({
      success: false,
      message: "❌ ระบบไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง",
      error: err.message
    });
  }
}
