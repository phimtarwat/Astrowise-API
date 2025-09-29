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

/**
 * 🔎 หา user จาก Google Sheet ด้วย userId + token
 */
export async function findUser(userId, token) {
  try {
    const uid = String(userId || "").trim();
    const tkn = String(token || "").trim();

    // ✅ กัน input แปลก ๆ ตั้งแต่ต้น
    if (!/^[0-9]+$/.test(uid) || !/^[A-Za-z0-9_-]+$/.test(tkn)) {
      console.warn("⚠️ findUser: invalid input format", { userId, token });
      return null;
    }

    const sheets = await getSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: RANGE,
    });

    const rows = res.data.values || [];
    const idx = rows.findIndex(
      (r) =>
        String(r[0] || "").trim() === uid &&
        String(r[1] || "").trim() === tkn
    );

    if (idx === -1) {
      console.warn("⚠️ findUser: not found", { uid });
      return null;
    }

    const r = rows[idx];
    return {
      user_id: String(r[0] || "").trim(),
      token: String(r[1] || "").trim(),
      expiry: r[2] || "",
      quota: parseInt(r[3] || "0", 10),
      used_count: parseInt(r[4] || "0", 10),
      package: (r[5] || "").trim(),
      email: r[6] || "",
      created_at: r[7] || "",
      payment_intent_id: r[8] || "",
      receipt_url: r[9] || "",
      paid_at: r[10] || "",
      _rowNumber: idx + 2, // +2 เพราะเริ่มที่ A2
    };
  } catch (err) {
    console.error("❌ findUser error:", err.message);
    return null;
  }
}

/**
 * ✏️ อัปเดตการใช้งาน (quota/used_count)
 */
export async function updateUsage(userId, token, newQuota) {
  try {
    const uid = String(userId || "").trim();
    const tkn = String(token || "").trim();

    const sheets = await getSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: RANGE,
    });

    const rows = res.data.values || [];
    const idx = rows.findIndex(
      (r) =>
        String(r[0] || "").trim() === uid &&
        String(r[1] || "").trim() === tkn
    );
    if (idx === -1) {
      console.warn("⚠️ updateUsage: user not found", { uid });
      return false;
    }

    const rowNumber = idx + 2;
    const currentUsed = parseInt(rows[idx][4] || "0", 10) + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: `Members!D${rowNumber}:E${rowNumber}`, // quota, used_count
      valueInputOption: "RAW",
      requestBody: { values: [[String(newQuota), String(currentUsed)]] },
    });

    console.log("✅ updateUsage success:", { uid, newQuota, currentUsed });
    return true;
  } catch (err) {
    console.error("❌ updateUsage error:", err.message, { userId, token });
    return false;
  }
}

/**
 * 🔧 updateUser: อัปเดต quota, expiry, package ฯลฯ
 */
export async function updateUser({
  userId,
  token,
  quota,
  packageName,
  expiry,
  payment_intent_id,
  receipt_url,
  paid_at,
}) {
  try {
    const uid = String(userId || "").trim();
    const tkn = String(token || "").trim();

    const sheets = await getSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: RANGE,
    });

    const rows = res.data.values || [];
    const idx = rows.findIndex(
      (r) =>
        String(r[0] || "").trim() === uid &&
        String(r[1] || "").trim() === tkn
    );

    if (idx === -1) {
      console.warn("⚠️ updateUser: user not found", { uid });
      return false;
    }

    const rowNumber = idx + 2;

    // อัปเดตหลาย column (C=expiry, D=quota, F=package, I=payment_intent_id, J=receipt_url, K=paid_at)
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: `Members!C${rowNumber}:K${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          expiry || "",
          String(quota || 0),
          rows[idx][4] || "0", // keep used_count เดิม
          packageName || "",
          rows[idx][6] || "",  // email เดิม
          rows[idx][7] || "",  // created_at เดิม
          payment_intent_id || "",
          receipt_url || "",
          paid_at || new Date().toISOString(),
        ]],
      },
    });

    console.log("✅ updateUser success:", { uid, quota, packageName });
    return true;
  } catch (err) {
    console.error("❌ updateUser error:", err.message, { userId, token });
    return false;
  }
}
