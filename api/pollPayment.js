// api/pollPayment.js
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

// helper: normalize string
const clean = v => (v || "").toString().trim();

export default async function handler(req, res) {
  const { paymentIntentId } = req.query;

  if (!paymentIntentId) {
    return res.status(400).json({
      success: false,
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
    console.log("📊 Total rows:", rows.length);

    // debug log แต่ละแถว
    rows.forEach((r, idx) => {
      console.log(
        `[Row ${idx + 2}]`, // +2 เพราะเริ่มที่ A2
        "user_id:", r[0],
        "payment_intent_id:", JSON.stringify(r[8])
      );
    });

    console.log("🔎 Looking for paymentIntentId:", JSON.stringify(paymentIntentId));

    const found = rows.find(r => clean(r[8]) === clean(paymentIntentId));

    if (!found) {
      console.warn("⚠️ Not found in sheet (after normalize)");
      return res.status(408).json({
        success: false,
        message: "⌛ ยังไม่พบข้อมูลการชำระเงิน กรุณารอสักครู่",
      });
    }

    const data = {
      userId: found[0],
      token: found[1],
      expiry: found[2],
      quota: parseInt(found[3] || "0", 10),
      used_count: parseInt(found[4] || "0", 10),
      package: found[5],
      email: found[6],
      created_at: found[7],
      payment_intent_id: clean(found[8]),
      receipt_url: found[9],
      paid_at: found[10],
    };

    // ✅ ทำข้อความ user_visible_message
    const userMessage =
      `✅ การชำระเงินสำเร็จแล้วค่ะ\n\n` +
      `🔑 โปรดบันทึกข้อมูลนี้ไว้สำหรับการใช้งาน\n` +
      `\`\`\`\nuser_id = ${data.userId}\ntoken   = ${data.token}\n\`\`\`\n\n` +
      `📦 แพ็กเกจ: ${data.package}\n` +
      `🎟️ สิทธิ์ที่ได้รับ: ${data.quota} ครั้ง\n` +
      `⏳ ใช้ได้ถึง: ${data.expiry}\n\n` +
      `คุณสามารถใช้ user_id และ token นี้ในการเข้าใช้งานระบบได้ ✨`;

    console.log("✅ Found row, returning data:", data);

    return res.json({
      success: true,
      message: "✅ ชำระเงินสำเร็จ",
      details: data,
      user_visible_message: userMessage,
    });
  } catch (err) {
    console.error("❌ Error reading Google Sheets:", err.message);
    return res.status(500).json({
      success: false,
      message: "❌ ไม่สามารถอ่านข้อมูลจาก Google Sheet ได้",
    });
  }
}
