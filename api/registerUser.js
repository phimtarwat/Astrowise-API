// api/registerUser.js
import { google } from "googleapis";
import { generateUserId, generateToken } from "../lib/token.js";

/**
 * สมัครสมาชิกใหม่ (Auto Register)
 * สร้าง user_id / token / quota=0 / expiry+5วัน
 * และเพิ่มลงใน Google Sheet
 */

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ status: "error", message: "❌ ต้องใช้ POST เท่านั้น" });
    }

    // 1️⃣ สร้างค่า user_id และ token แบบสุ่ม 5 หลัก
    const user_id = generateUserId();
    const token = generateToken();

    // 2️⃣ ตั้งค่าพื้นฐาน
    const now = new Date();
    const expiry = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // +5 วัน
    const formattedExpiry = expiry.toISOString().split("T")[0];

    const newRow = [
      user_id,           // A: user_id
      token,             // B: token
      0,                 // C: quota
      0,                 // D: used_count
      "",                // E: package (ยังไม่มี)
      formattedExpiry,   // F: expiry (+5 วัน)
      "",                // G: email (ยังไม่มี)
      now.toISOString(), // H: created_at
      "", "", "",        // I–K: payment, receipt, paid_at
    ];

    // 3️⃣ เขียนลง Google Sheet
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Members!A:K",
      valueInputOption: "RAW",
      requestBody: { values: [newRow] },
    });

    console.log(`✅ Register success → user_id=${user_id}, token=${token}`);

    // 4️⃣ ตอบกลับให้ผู้ใช้ในแชท
    return res.status(200).json({
      status: "valid",
      message: [
        "✅ สมัครสมาชิกสำเร็จแล้ว!",
        `🔑 user_id: ${user_id}`,
        `🔒 token: ${token}`,
        "",
        "โปรดจดบันทึก user_id และ token ไว้สำหรับเข้าใช้งานครั้งถัดไป",
        "⚠️ คุณยังไม่มีสิทธิ์ดูดวงจนกว่าจะเลือกซื้อแพ็กเกจ",
        "⏰ หากไม่ซื้อภายใน 5 วัน ข้อมูลของคุณจะถูกลบออกจากระบบอัตโนมัติ",
      ].join("\n"),
      user_id,
      token,
      quota: 0,
      expiry: formattedExpiry,
    });
  } catch (err) {
    console.error("❌ registerUser error:", err);
    return res.status(500).json({ status: "error", message: "❌ ระบบสมัครสมาชิกขัดข้อง กรุณาลองใหม่ภายหลัง" });
  }
}
