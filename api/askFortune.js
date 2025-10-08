// api/askFortune.js
import { findUser, logUsage } from "../lib/googleSheet.js";
import { calcAstroChart } from "../lib/astrologyCoreCalc.js";
import { google } from "googleapis";

/**
 * ✅ อัปเดต quota ใน Google Sheet
 */
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

/**
 * ✅ API: /api/askFortune
 * ใช้ Custom GPT วิเคราะห์เอง (ไม่เรียก OpenAI API)
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "❌ ต้องใช้ POST เท่านั้น" });
  }

  const { user_id, token, question, birth } = req.body || {};

  if (!user_id || !token) {
    return res.status(400).json({ status: "error", message: "❌ ต้องส่ง user_id และ token ก่อนถามดวง" });
  }

  if (!question || question.trim() === "") {
    return res.status(400).json({ status: "error", message: "❌ ต้องส่งคำถามเพื่อดูดวง (question)" });
  }

  // ✅ ตรวจสอบสิทธิ์ผู้ใช้
  const user = await findUser(user_id, token);
  if (!user) {
    return res.status(401).json({ status: "invalid", message: "❌ user_id หรือ token ไม่ถูกต้อง" });
  }

  // ✅ ตรวจสอบแพ็กเกจและวันหมดอายุ
  if (!user.package) {
    return res.status(401).json({ status: "no_package", message: "❌ ยังไม่ได้ซื้อแพ็กเกจ" });
  }

  if (user.expiry && new Date() > new Date(user.expiry)) {
    return res.status(401).json({ status: "expired", message: "❌ สิทธิ์หมดอายุแล้ว" });
  }

  if (user.quota <= 0) {
    return res.status(200).json({
      status: "no_quota",
      message: "❌ สิทธิ์ของคุณหมดแล้ว กรุณาซื้อแพ็กเกจใหม่",
    });
  }

  // ✅ หัก quota
  const newQuota = user.quota - 1;
  const newUsedCount = (user.used_count || 0) + 1;
  const updated = await updateQuota(user.user_id, user.token, newQuota, newUsedCount);
  if (!updated) {
    return res.status(500).json({
      status: "error",
      message: "❌ ระบบอัปเดต quota ไม่สำเร็จ",
    });
  }

  await logUsage(user.user_id, user.token, question, newQuota, user.package);

  // 🪐 ถ้ามีข้อมูลวันเวลาเกิด → คำนวณดวงจริง
  let astroData = null;
  if (birth && birth.date && birth.time && birth.lat && birth.lng && birth.zone) {
    console.log(`🪐 Calculating chart for ${birth.date} ${birth.time} (${birth.zone})`);
    astroData = await calcAstroChart(birth);
  }

  // ✅ ส่งข้อมูลให้ Custom GPT วิเคราะห์เอง
  const response = {
    status: "valid",
    remaining: newQuota,
    question,
    message: `🔮 "${question}" — ระบบพร้อมให้วิเคราะห์คำทำนาย`,
    astroData, // ⭐️ Custom GPT จะใช้ข้อมูลนี้ต่อ
  };

  if (newQuota < 3) {
    response.warning = `⚠️ เหลือสิทธิ์อีกเพียง ${newQuota} ครั้ง`;
  }

  console.log(`🎯 AskFortune done: user=${user_id}, remaining=${newQuota}`);
  return res.status(200).json(response);
}
