// lib/googleSheet.js
import { google } from "googleapis";

async function getSheet() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

const RANGE = "Members!A2:K"; // A..K ตามหัวตารางของคุณ

// อ่าน user ตามสคีม A..K
export async function findUser(userId, token) {
  try {
    const sheets = await getSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: RANGE,
    });
    const rows = res.data.values || [];
    const idx = rows.findIndex(r => r[0] === userId && r[1] === token);
    if (idx === -1) return null;

    const r = rows[idx];
    return {
      user_id: r[0] || "",
      token: r[1] || "",
      expiry: r[2] || "",
      quota: parseInt(r[3] || "0", 10),
      used_count: parseInt(r[4] || "0", 10),
      package: r[5] || "",
      email: r[6] || "",
      created_at: r[7] || "",
      payment_intent_id: r[8] || "",
      receipt_url: r[9] || "",
      paid_at: r[10] || "",
      _rowNumber: idx + 2, // สำหรับ update ทีหลัง (เริ่มนับจาก A2)
    };
  } catch (err) {
    console.error("❌ Error reading Google Sheets:", err.message);
    return null;
  }
}

// หัก quota + เพิ่ม used_count = used_count+1
export async function updateUsage(userId, token, newQuota) {
  try {
    const sheets = await getSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: RANGE,
    });
    const rows = res.data.values || [];
    const idx = rows.findIndex(r => r[0] === userId && r[1] === token);
    if (idx === -1) return false;

    const rowNumber = idx + 2;
    const currentUsed = parseInt((rows[idx][4] || "0"), 10) + 1;

    // อัปเดต D(quota) และ E(used_count) พร้อมกัน
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: `Members!D${rowNumber}:E${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [[String(newQuota), String(currentUsed)]] },
    });
    return true;
  } catch (err) {
    console.error("❌ Error updating Google Sheets:", err.message);
    return false;
  }
}

// เพิ่มแถวใหม่ตอนชำระเงินสำเร็จ (map ให้ตรงกับหัวคอลัมน์ A..K)
export async function addUser({
  userId,
  token,
  expiry,                // YYYY-MM-DD
  quota,
  used_count = 0,
  packageName = "",
  email = "",
  created_at,            // ISO string
  payment_intent_id = "",
  receipt_url = "",
  paid_at,               // ISO string
}) {
  try {
    const sheets = await getSheet();
    const nowIso = new Date().toISOString();

    const values = [[
      userId,                 // A user_id
      token,                  // B token
      expiry || "",           // C expiry
      quota,                  // D quota
      used_count,             // E used_count
      packageName,            // F package (lite/standard/premium)
      email,                  // G e-mail
      created_at || nowIso,   // H created_at
      payment_intent_id,      // I payment_intent_id
      receipt_url,            // J receipt_url
      paid_at || nowIso,      // K paid_at
    ]];

    const resp = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID,
      range: RANGE,
      valueInputOption: "RAW",
      requestBody: { values },
    });

    console.log("✅ Sheets append ok:", resp.data.updates?.updatedRange || resp.data);
    return true;
  } catch (err) {
    console.error("❌ Error writing to Google Sheets:", err.message, err);
    return false;
  }
}
