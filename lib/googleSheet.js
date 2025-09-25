// lib/googleSheet.js
import { google } from "googleapis";

async function getSheet() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// Schema Google Sheet:
// A:user_id | B:token | C:expiry | D:quota | E:used_count |
// F:package | G:e-mail | H:created_at | I:payment_intent_id | J:receipt_url | K:paid_at
const RANGE = "Members!A2:K";

// 🔎 หา user จาก Google Sheet
export async function findUser(userId, token) {
  try {
    const sheets = await getSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: RANGE,
    });

    const rows = res.data.values || [];

    // ✅ บังคับให้เป็น string และ trim ก่อนเปรียบเทียบ
    const idx = rows.findIndex(
      (r) =>
        String(r[0] || "").trim() === String(userId).trim() &&
        String(r[1] || "").trim() === String(token).trim()
    );

    if (idx === -1) return null;

    const r = rows[idx];
    return {
      user_id: String(r[0] || "").trim(),
      token: String(r[1] || "").trim(),
      expiry: r[2],
      quota: parseInt(r[3] || "0", 10),
      used_count: parseInt(r[4] || "0", 10),
      package: r[5],
      email: r[6],
      created_at: r[7],
      payment_intent_id: r[8],
      receipt_url: r[9],
      paid_at: r[10],
      _rowNumber: idx + 2, // บวก 2 เพราะเริ่มที่ A2
    };
  } catch (err) {
    console.error("❌ Error reading Google Sheets:", err.message);
    return null;
  }
}

// ✏️ อัปเดต quota และ used_count (+1)
export async function updateUsage(userId, token, newQuota) {
  try {
    const sheets = await getSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: RANGE,
    });

    const rows = res.data.values || [];
    const idx = rows.findIndex(
      (r) =>
        String(r[0] || "").trim() === String(userId).trim() &&
        String(r[1] || "").trim() === String(token).trim()
    );
    if (idx === -1) return false;

    const rowNumber = idx + 2;
    const currentUsed = parseInt(rows[idx][4] || "0", 10) + 1;

    // update quota (D) + used_count (E)
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

// ➕ เพิ่ม user ใหม่ (Stripe webhook success)
export async function addUser({
  userId,
  token,
  expiry,
  quota,
  used_count = 0,
  packageName = "",
  email = "",
  created_at,
  payment_intent_id = "",
  receipt_url = "",
  paid_at,
}) {
  try {
    const sheets = await getSheet();
    const nowIso = new Date().toISOString();

    const values = [
      [
        String(userId),
        String(token),
        expiry,
        quota,
        used_count,
        packageName,
        email,
        created_at || nowIso,
        payment_intent_id,
        receipt_url,
        paid_at || nowIso,
      ],
    ];

    const resp = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID,
      range: RANGE,
      valueInputOption: "RAW",
      requestBody: { values },
    });

    console.log(
      "✅ Sheets append ok:",
      resp.data.updates?.updatedRange || resp.data
    );
    return true;
  } catch (err) {
    console.error("❌ Error writing to Google Sheets:", err.message, err);
    return false;
  }
}
