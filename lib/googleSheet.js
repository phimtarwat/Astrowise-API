// lib/googleSheet.js
import { google } from "googleapis";

/**
 * ฟังก์ชันเชื่อมต่อ Google Sheet ผ่าน Service Account
 */
async function getSheet() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/**
 * เพิ่มสมาชิกใหม่ลงในชีท Members
 * ใช้ตอนสมัครสมาชิก (registerUser)
 */
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

/**
 * ค้นหาผู้ใช้ในชีท Members ตาม user_id + token
 * ใช้ใน checkToken และ askFortune
 */
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
          used_count: parseInt(row[header.indexOf("used_count")], 10) || 0, // ✅ คืนค่า used_count
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

/**
 * ฟังก์ชันบันทึกการใช้งานในชีท UsageLog
 * ใช้ตอนเรียก askFortune (เพื่อบันทึกคำถาม/คงเหลือ)
 */
export async function logUsage(user_id, token, question, remaining, pkg) {
  try {
    const sheets = await getSheet();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = "UsageLog!A:F"; // ✅ header: timestamp | user_id | token | question | remaining | package

    const row = [
      new Date().toISOString(),
      user_id,
      token,
      question,
      remaining,
      pkg || null,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    console.log(`📝 Usage logged for ${user_id} (${remaining} left)`);
    return true;
  } catch (err) {
    console.error("❌ logUsage failed:", err.message);
    return false;
  }
}
