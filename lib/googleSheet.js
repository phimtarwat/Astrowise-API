// lib/googleSheet.js
import { google } from "googleapis";

async function getSheet() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
  } catch (err) {
    console.error("❌ getSheet auth error:", err.message);
    throw err;
  }
}

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
    const idx = rows.findIndex(
      (r) =>
        String(r[0] || "").trim() === String(userId).trim() &&
        String(r[1] || "").trim() === String(token).trim()
    );

    if (idx === -1) {
      console.warn("⚠️ findUser: not found", { userId, token });
      return null;
    }

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
      _rowNumber: idx + 2,
    };
  } catch (err) {
    console.error("❌ findUser error:", err.message);
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
    if (idx === -1) {
      console.warn("⚠️ updateUsage: user not found", { userId, token });
      return false;
    }

    const rowNumber = idx + 2;
    const currentUsed = parseInt(rows[idx][4] || "0", 10) + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: `Members!D${rowNumber}:E${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [[String(newQuota), String(currentUsed)]] },
    });

    console.log("✅ updateUsage success:", { userId, token, newQuota, currentUsed });
    return true;
  } catch (err) {
    console.error("❌ updateUsage error:", err.message, { userId, token });
    return false;
  }
}

// ➕ เพิ่ม user ใหม่
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

    const values = [[
      String(userId),
      String(token),
      expiry || "",
      quota,
      used_count,
      packageName,
      email,
      created_at || nowIso,
      payment_intent_id,
      receipt_url,
      paid_at || nowIso,
    ]];

    const resp = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID,
      range: RANGE,
      valueInputOption: "RAW",
      requestBody: { values },
    });

    console.log("✅ addUser success:", userId, resp.data.updates?.updatedRange);
    return true;
  } catch (err) {
    console.error("❌ addUser error:", err.message, { userId, token, email });
    return false;
  }
}
