// api/stripeWebhook.js
import Stripe from "stripe";
import { google } from "googleapis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false, // ✅ ต้องปิด bodyParser เพื่อให้ Stripe ตรวจลายเซ็นได้
  },
};

/**
 * ✅ ฟังก์ชันอัปเดตสิทธิ์สมาชิกใน Google Sheet
 * - ต่ออายุจากวันเดิมถ้ายังไม่หมด
 * - บวก quota เดิม + quota ใหม่
 */
async function updateMemberQuota({ user_id, token, packageName, quota, paymentIntentId, receiptUrl }) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = "Members!A:K";

    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values;
    if (!rows || rows.length === 0) return false;

    const header = rows[0];
    const userIdIndex = header.indexOf("user_id");
    const tokenIndex = header.indexOf("token");
    const quotaIndex = header.indexOf("quota");
    const usedIndex = header.indexOf("used_count");
    const packageIndex = header.indexOf("package");
    const expiryIndex = header.indexOf("expiry");
    const paymentIntentIndex = header.indexOf("payment_intent_id");
    const receiptUrlIndex = header.indexOf("receipt_url");
    const paidAtIndex = header.indexOf("paid_at");

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][userIdIndex] === user_id && rows[i][tokenIndex] === token) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex === -1) return false;

    // ✅ อ่าน quota และ expiry เดิม
    const oldQuota = parseInt(rows[rowIndex - 1][quotaIndex], 10) || 0;
    const oldExpiry = rows[rowIndex - 1][expiryIndex];
    const now = new Date();

    // ✅ คำนวณ quota ใหม่
    const newQuota = oldQuota + Number(quota || 0);

    // ✅ ถ้ามี expiry เดิมและยังไม่หมด → ต่อจากวันเดิม
    let baseDate = now;
    if (oldExpiry && new Date(oldExpiry) > now) {
      baseDate = new Date(oldExpiry);
    }

    const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // ✅ เขียนกลับ Google Sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Members!${String.fromCharCode(65 + packageIndex)}${rowIndex}:${String.fromCharCode(
        65 + paidAtIndex
      )}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          packageName,
          newQuota,
          newExpiry,
          paymentIntentId,
          receiptUrl,
          new Date().toISOString(),
        ]],
      },
    });

    console.log(`✅ Updated member ${user_id}: quota +${quota}, expiry=${newExpiry}`);
    return { newQuota, newExpiry };
  } catch (err) {
    console.error("❌ updateMemberQuota failed:", err.message);
    return false;
  }
}

/**
 * ✅ Stripe Webhook Handler
 * ฟัง event จาก Stripe ทุกครั้งที่ชำระเงินสำเร็จ
 */
export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const buf = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(Buffer.from(data)));
      req.on("error", reject);
    });
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { user_id, token, packageName, quota } = session.metadata || {};

    if (!user_id || !token || !packageName) {
      console.error("❌ Missing metadata in session:", session.metadata);
      return res.status(400).json({ status: "error", message: "Missing metadata" });
    }

    const receiptUrl =
      session?.charges?.data?.[0]?.receipt_url ||
      session?.payment_intent?.charges?.data?.[0]?.receipt_url ||
      null;

    const updated = await updateMemberQuota({
      user_id,
      token,
      packageName,
      quota,
      paymentIntentId: session.payment_intent,
      receiptUrl,
    });

    if (updated) {
      console.log(`🎉 Member updated: user=${user_id}, newQuota=${updated.newQuota}`);
      return res.status(200).json({
        status: "success",
        message: "✅ Payment received and quota updated",
        user_id,
        newQuota: updated.newQuota,
        newExpiry: updated.newExpiry,
      });
    } else {
      return res.status(500).json({
        status: "error",
        message: "❌ Failed to update member quota",
      });
    }
  }

  // ✅ กรณี event อื่น
  console.log(`ℹ️ Received unrelated event: ${event.type}`);
  return res.status(200).json({ received: true });
}
