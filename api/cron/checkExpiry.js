// api/cron/checkExpiry.js
import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = "Members!A:K";

    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = resp.data.values;
    if (!rows || rows.length <= 1) return res.json({ message: "ไม่มีข้อมูล" });

    const header = rows[0];
    const expiryIndex = header.indexOf("expiry");

    const today = new Date().toISOString().split("T")[0];
    const remaining = [rows[0]]; // keep header

    for (let i = 1; i < rows.length; i++) {
      const expiry = rows[i][expiryIndex];
      if (expiry && expiry > today) remaining.push(rows[i]);
    }

    // เขียนกลับเฉพาะที่ยังไม่หมดอายุ
    await sheets.spreadsheets.values.clear({ spreadsheetId, range });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: remaining },
    });

    return res.status(200).json({ message: "ลบข้อมูลที่หมดอายุแล้วเรียบร้อย ✅" });
  } catch (err) {
    console.error("checkExpiry error:", err);
    return res.status(500).json({ error: err.message });
  }
}
