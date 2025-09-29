// api/askFortune.js
import { findUser } from "../lib/googleSheet.js";

/**
 * อัปเดต quota/used_count ของ user
 */
import { google } from "googleapis";
async function updateQuota(user_id, token, newQuota, newUsedCount) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = "Members!A:K";

    // โหลดข้อมูลทั้งหมด
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = resp.data.values;
    const header = rows[0];

    const userIdIndex = header.indexOf("user_id");
    const tokenIndex = header.indexOf("token");
    const quotaIndex = header.indexOf("quota");
    const usedIndex = header.indexOf("used_count");

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][userIdIndex] === user_id && rows[i][tokenIndex] === token) {
        rowIndex = i + 1; // index ใน sheet (1-based)
        break;
      }
    }

    if (rowIndex === -1) return false;

    // อัปเดต quota และ used_count
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Members!${String.fromCharCode(65 + quotaIndex)}${rowIndex}:${
        String.fromCharCode(65 + usedIndex)
      }${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[newQuota, newUsedCount]],
      },
    });

    return true;
  } catch (err) {
    console.error("❌ updateQuota failed:", err.message);
    return false;
  }
}

export default async function handler(req, res) {
  try {
    // ✅ 1) ต้องใช้ POST
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "❌ Method not allowed, ต้องใช้ POST เท่านั้น",
      });
    }

    const { user_id, token, question } = req.body || {};
    if (!user_id || !token || !question) {
      return res.status(400).json({
        success: false,
        message: "❌ ต้องส่ง user_id, token และ question",
      });
    }

    // ✅ 2) หา user
    const user = await findUser(user_id, token);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "❌ user_id หรือ token ไม่ถูกต้อง",
      });
    }

    // ✅ 3) เช็ค package, quota, expiry
    if (!user.package) {
      return res.status(401).json({
        success: false,
        message: "❌ ยังไม่ได้ซื้อแพ็กเกจ กรุณาซื้อก่อนใช้งาน",
      });
    }

    const today = new Date();
    if (user.expiry && today > new Date(user.expiry)) {
      return res.status(401).json({
        success: false,
        message: "❌ สิทธิ์หมดอายุแล้ว กรุณาต่ออายุแพ็กเกจ",
      });
    }

    if (user.quota <= 0) {
      return res.status(401).json({
        success: false,
        message: "❌ สิทธิ์ของคุณหมดแล้ว กรุณาซื้อแพ็กเกจใหม่ค่ะ",
      });
    }

    // ✅ 4) อัปเดต quota/used_count
    const newQuota = user.quota - 1;
    const newUsedCount = (user.used_count || 0) + 1;
    const updated = await updateQuota(user.user_id, user.token, newQuota, newUsedCount);

    if (!updated) {
      return res.status(500).json({
        success: false,
        message: "❌ อัปเดต quota ไม่สำเร็จ",
      });
    }

    // ✅ 5) ตอบคำทำนาย (mock GPT)
    return res.status(200).json({
      success: true,
      remaining: newQuota,
      answer: `🔮 คำทำนายสำหรับคำถาม "${question}" คือ... (นี่คือ mock answer, ต่อไปจะต่อ GPT)`,
    });
  } catch (err) {
    console.error("❌ askFortune failed:", err.message);
    return res.status(500).json({
      success: false,
      message: "❌ ระบบ askFortune ล้มเหลว",
      error: err.message,
    });
  }
}
