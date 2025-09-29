// api/registerUser.js
import { generateUserId, generateToken } from "../lib/token.js";
import { addUser } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const userId = generateUserId();
  const token = generateToken();
  const nowIso = new Date().toISOString();

  // สมัคร → quota=0, package=null
  await addUser({
    userId,
    token,
    quota: 0,
    used_count: 0,
    packageName: null,
    expiry: null,
    email: req.body.email || null,
    created_at: nowIso,
    payment_intent_id: null,
    receipt_url: null,
    paid_at: null
  });

  return res.json({
    success: true,
    message: "✅ สมัครสมาชิกสำเร็จ (ยังไม่มีสิทธิ์)",
    user_id: userId,
    token,
    quota: 0,
    package: null,
    expiry: null
  });
}

