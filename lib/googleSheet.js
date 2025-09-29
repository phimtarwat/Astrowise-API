// lib/googleSheet.js
import { google } from "googleapis";

/**
 * สร้าง client ของ Google Sheets
 */
async function getSheet() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    return google.sheets({ version: "v4", auth });
  } catch (err) {
    console.error("❌ Google Sheets auth failed:", err.message);
    throw err;
  }
}

/**
 * เพิ่ม user ใหม่ลง Google Sheet
 * @param {object} userData
 * @returns {boolean}
 */
export async function addUser(userData) {
  try {
    const sheets = await getSheet();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = "Members!A:K"; // ครอบคลุม 11 column ตาม schema

    const row = [
      userData.user_id,
      userData.token,
      userData.quota,
      userData.used_count,
      userData.package,
      userData.expiry,
      userData.email,
      userData.created_at,
      userData.payment_intent_id,
      userData.receipt_url,
      userData.paid_at,
    ];

    console.log("👉 Trying to append row:", row);

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    console.log("👉 Google API response:", response.status, response.data);

    return response.status === 200;
  } catch (err) {
    console.error("❌ addUser failed:", err.message);
    return false;
  }
}

/**
 * ค้นหา user ใน Google Sheet
 * @param {string} user_id
 * @param {string} token
 * @returns {object|null}
 */
export async function findUser(user_id, token) {
  try {
    const sheets = await getSheet();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = "Members!A:K";

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.warn("⚠️ Sheet is empty");
      return null;
    }

    const header = rows[0];
    console.log("👉 Header row:", header);

    const userIdIndex = header.indexOf("user_id");
    const tokenIndex = header.indexOf("token");

    if (userIdIndex === -1 || tokenIndex === -1) {
      console.error("❌ Header missing user_id or token");
      return null;
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[userIdIndex] === user_id && row[tokenIndex] === token) {
        return {
          user_id: row[userIdIndex],
          token: row[tokenIndex],
          quota: parseInt(row[header.indexOf("quota")], 10) || 0,
          used_count: parseInt(row[header.indexOf("used_count")], 10) || 0,
          package: row[header.indexOf("package")] || null,
          expiry: row[header.indexOf("expiry")] || null,
          email: row[header.indexOf("email")] || null,
          created_at: row[header.indexOf("created_at")] || null,
          payment_intent_id: row[header.indexOf("payment_intent_id")] || null,
          receipt_url: row[header.indexOf("receipt_url")] || null,
          paid_at: row[header.indexOf("paid_at")] || null,
        };
      }
    }

    return null;
  } catch (err) {
    console.error("❌ findUser failed:", err.message);
    return null;
  }
}
