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
 * @param {object} userData - ข้อมูล user
 * @returns {boolean} - true ถ้าบันทึกสำเร็จ
 */
export async function addUser(userData) {
  try {
    const sheets = await getSheet();

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = "Members!A:Z"; // สมมติว่าเก็บใน sheet ชื่อ Members

    // ✅ mapping ให้ตรงกับ schema
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

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row],
      },
    });

    if (response.status === 200) {
      console.log("✅ addUser stored:", userData.user_id);
      return true;
    } else {
      console.error("⚠️ addUser unexpected response:", response.status);
      return false;
    }
  } catch (err) {
    console.error("❌ addUser failed:", err.message);
    return false;
  }
}

/**
 * ค้นหา user ใน Google Sheet (เช็ค token)
 * @param {string} user_id
 * @param {string} token
 * @returns {object|null}
 */
export async function findUser(user_id, token) {
  try {
    const sheets = await getSheet();

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = "Members!A:K"; // ต้องครอบคลุม field ทั้งหมด

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }

    // หาว่า row ไหนมี user_id + token ตรงกัน
    const header = rows[0];
    const userIdIndex = header.indexOf("user_id");
    const tokenIndex = header.indexOf("token");

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[userIdIndex] === user_id && row[tokenIndex] === token) {
        // คืนค่าเป็น object
        return {
          user_id: row[userIdIndex],
          token: row[tokenIndex],
          quota: parseInt(row[header.indexOf("quota")], 10) || 0,
          used_count: parseInt(row[header.indexOf("used_count")], 10) || 0,
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
