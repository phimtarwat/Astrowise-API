// api/getLatestUser.js
import { google } from "googleapis";

async function getSheet() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// Schema Google Sheet:
// A:user_id | B:token | C:expiry | D:quota | E:used_count |
// F:package | G:e-mail | H:created_at | I:payment_intent_id | J:receipt_url | K:paid_at
const RANGE = "Members!A2:K";

export default async function handler(req, res) {
  const { paymentIntentId } = req.query;

  if (!paymentIntentId) {
    return res.status(400).json({
      error: "missing_paymentIntentId",
      message: "❌ ต้องส่ง paymentIntentId มาด้วย",
    });
  }

  try {
    const sheets = await getSheet();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: RANGE,
    });

    const rows = resp.data.values || [];
    const found = rows.find(r => r[8] === paymentIntentId); // คอลัมน์ I = payment_intent_id

    if (!found) {
      return res.status(404).json({
        status: "pending",
        message: "⚠️ ยังไม่พบข้อมูลการชำระเงินนี้ในระบบ",
      });
    }

    const data = {
      status: "paid",
      userId: found[0],
      token: found[1],
      expiry: found[2],
      quota: parseInt(found[3] || "0", 10),
      used_count: parseInt(found[4] || "0", 10),
      package: found[5],
      email: found[6],
      created_at: found[7],
      payment_intent_id: found[8],
      receipt_url: found[9],
      paid_at: found[10],
    };

    return res.json(data);
  } catch (err) {
    console.error("❌ Error reading Google Sheet:", err.message);
    return res.status(500).json({
      error: "sheet_error",
      message: "ไม่สามารถอ่านข้อมูลจาก Google Sheet ได้",
    });
  }
}
