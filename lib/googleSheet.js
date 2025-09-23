// lib/googleSheet.js
import { google } from "googleapis";

async function getSheet() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// 🔎 ค้นหา user จาก Members sheet
export async function findUser(userId, token) {
  const sheets = await getSheet();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: "Members!A2:G", // ✅ ใช้ Members แทน Users
  });

  const rows = res.data.values || [];
  const user = rows.find(r => r[0] === userId && r[1] === token);
  if (!user) return null;

  return {
    user_id: user[0],
    token: user[1],
    email: user[2],
    quota: parseInt(user[3], 10),
    created_at: user[4],
    paid_at: user[5],
    payment_intent_id: user[6],
  };
}

// ✏️ อัปเดต quota ของ user
export async function updateQuota(userId, token, quota) {
  const sheets = await getSheet();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: "Members!A2:G", // ✅ ใช้ Members
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === userId && r[1] === token);

  if (rowIndex === -1) return false;

  const rowNumber = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SHEET_ID,
    range: `Members!D${rowNumber}`, // ✅ ใช้ Members
    valueInputOption: "RAW",
    requestBody: { values: [[quota.toString()]] },
  });
  return true;
}

// ➕ เพิ่ม user ใหม่ตอนจ่ายเงินสำเร็จ
export async function addUser({ userId, token, email, quota, payment_intent_id, paid_at }) {
  try {
    const sheets = await getSheet();
    console.log("👉 Adding user:", { userId, token, email, quota, paid_at, payment_intent_id });

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID,
      range: "Members!A2:G", // ✅ ใช้ Members
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          userId,
          token,
          email,
          quota,
          new Date().toISOString(),
          paid_at,
          payment_intent_id
        ]],
      },
    });

    console.log("✅ Google Sheets append response:", response.data);
    return true;
  } catch (err) {
    console.error("❌ Error writing to Google Sheets:", err.message, err);
    return false;
  }
}
