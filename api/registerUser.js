import { generateUserId, generateToken } from "../lib/token.js";
import { addUser } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "❌ ต้องใช้ POST" });
  }

  try {
    const userId = generateUserId();
    const token = generateToken();
    const nowIso = new Date().toISOString();

    const userData = {
      user_id: userId,
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

    const added = await addUser(userData);
    if (!added) {
      return res.status(500).json({ success: false, message: "❌ สมัครไม่สำเร็จ" });
    }

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
    return res.status(500).json({ success: false, message: err.message });
  }
}
