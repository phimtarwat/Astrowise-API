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
    if (!rows || rows.length < 2)
      return res.status(200).json({ message: "No users found" });

    const header = rows[0];
    const expiryIndex = header.indexOf("expiry");
    const emailIndex = header.indexOf("email");

    const now = new Date();
    let expiredCount = 0;
    let nearExpireCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const expiry = new Date(rows[i][expiryIndex]);
      if (isNaN(expiry)) continue;

      const diffDays = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) expiredCount++;
      else if (diffDays <= 5) nearExpireCount++;
    }

    console.log(`📅 Expired=${expiredCount}, Near expiry=${nearExpireCount}`);
    return res.status(200).json({
      status: "ok",
      expiredCount,
      nearExpireCount,
      checkedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("❌ checkExpiry failed:", err.message);
    return res.status(500).json({ status: "error", message: err.message });
  }
}
