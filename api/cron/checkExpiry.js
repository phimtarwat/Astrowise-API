// api/cron/checkExpiry.js
import { google } from "googleapis";

/**
 * ✅ Cron job สำหรับลบสมาชิกที่หมดอายุ
 * - ใช้ลบผู้ใช้ที่ expiry < วันนี้
 * - ออกแบบให้เรียกทุกวัน (ผ่าน Vercel Cron หรือ CRON job ภายนอก)
 */
export default async function handler(req, res) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = "Members!A:K";

    // ดึงข้อมูลจาก Sheet
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = result.data.values;
    if (!rows || rows.length <= 1) {
      return res.status(200).json({ message: "ไม่มีข้อมูลให้ตรวจสอบ" });
    }

    const header = rows[0];
    const expiryIndex = header.indexOf("expiry");
    const packageIndex = header.indexOf("package");

    if (expiryIndex === -1) {
      throw new Error("ไม่พบ column 'expiry' ใน Sheet");
    }

    const today = new Date().toISOString().split("T")[0];
    const keptRows = [header]; // แถวหัวตาราง
    const removedRows = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const expiry = row[expiryIndex];
      const pkg = row[packageIndex];
      if (!expiry) continue;

      // เงื่อนไขลบ: หมดอายุ และยังไม่มี package
      if (expiry < today && (!pkg || pkg.trim() === "")) {
        removedRows.push(row);
      } else {
        keptRows.push(row);
      }
    }

    // เขียนข้อมูลกลับ (เฉพาะที่ยังไม่หมดอายุ)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: keptRows },
    });

    console.log(`🧹 ลบสมาชิกหมดอายุแล้ว ${removedRows.length} ราย`);
    return res.status(200).json({
      status: "success",
      message: `🧹 ลบสมาชิกหมดอายุแล้ว ${removedRows.length} ราย`,
    });
  } catch (err) {
    console.error("❌ checkExpiry error:", err);
    return res.status(500).json({
      status: "error",
      message: "❌ ระบบลบสมาชิกขัดข้อง: " + err.message,
    });
  }
}
