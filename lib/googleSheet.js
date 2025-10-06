// lib/googleSheet.js
import { google } from "googleapis";

async function getSheet() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export async function addUser(userData) {
  try {
    const sheets = await getSheet();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = "Members!A:K";

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

    console.log("👉 Append row:", row);

    const resp = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return resp.status === 200;
  } catch (err) {
    console.error("❌ addUser failed:", err.message);
    return false;
  }
}

export async function findUser(user_id, token) {
  try {
    const sheets = await getSheet();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = "Members!A:K";

    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = resp.data.values;
    if (!rows || rows.length === 0) return null;

    const header = rows[0];
    const userIdIndex = header.indexOf("user_id");
    const tokenIndex = header.indexOf("token");
    if (userIdIndex === -1 || tokenIndex === -1) return null;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[userIdIndex] === user_id && row[tokenIndex] === token) {
        return {
          user_id: row[userIdIndex],
          token: row[tokenIndex],
          quota: parseInt(row[header.indexOf("quota")], 10) || 0,
          used_count: parseInt(row[header.indexOf("used_count")], 10) || 0, // ✅ เพิ่มคืนค่า used_count
          package: row[header.indexOf("package")] || null,
          expiry: row[header.indexOf("expiry")] || null,
          email: row[header.indexOf("email")] || null,
        };
      }
    }
    return null;
  } catch (err) {
    console.error("❌ findUser failed:", err.message);
    return null;
  }
}
