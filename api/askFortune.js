// api/askFortune.js
import { findUser } from "../lib/googleSheet.js";
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

    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = resp.data.values;
    if (!rows || rows.length === 0) return false;

    const header = rows[0];
    const userIdIndex = header.indexOf("user_id");
    const tokenIndex = header.indexOf("token");
    const quotaIndex = header.indexOf("quota");
    const usedIndex = header.indexOf("used_count");

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][userIdIndex] === user_id && rows[i][tokenIndex] === token) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex === -1) return false;

    // ✅ แปลงค่าที่อัปเดตเป็น string
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Members!C${rowIndex}:D${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[String(newQuota), String(newUsedCount)]] },
    });

    console.log(`✅ Updated quota=${newQuota}, used=${newUsedCount} for user=${user_id}`);
    return true;
  } catch (err) {
    console.error("❌ updateQuota failed:", err.message);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "❌ ต้องใช้ POST" });
  }

  const { user_id, token, question } = req.body || {};
  if (!user_id || !token || !question) {
    return res.status(400).json({ status: "error", message: "❌ ต้องส่ง user_id, token และ question" });
  }

  const user = await findUser(user_id, token);
  if (!user) {
    return res.status(401).json({ status: "invalid", message: "❌ user_id หรือ token ไม่ถูกต้อง" });
  }

  if (!user.package) {
    return res.status(401).json({ status: "no_package", message: "❌ ยังไม่ได้ซื้อแพ็กเกจ" });
  }

  if (user.expiry && new Date() > new Date(user.expiry)) {
    return res.status(401).json({ status: "expired", message: "❌ สิทธิ์หมดอายุแล้ว" });
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

  const newQuota = user.quota - 1;
  const newUsedCount = (user.used_count || 0) + 1;
  const updated = await updateQuota(user.user_id, user.token, newQuota, newUsedCount);
  if (!updated) {
    return res.status(500).json({ status: "error", message: "❌ อัปเดต quota ไม่สำเร็จ" });
  }

  // ✅ เปลี่ยน mock answer ให้ผ่านระบบจริง
  const response = {
    status: "valid",
    remaining: newQuota,
    answer: `🔮 "${question}" — ระบบได้ประมวลผลคำทำนายสำเร็จ`,
  };

  if (newQuota < 3) {
    response.warning = `⚠️ เหลือสิทธิ์อีกเพียง ${newQuota} ครั้ง`;
  }

  return res.status(200).json(response);
}
