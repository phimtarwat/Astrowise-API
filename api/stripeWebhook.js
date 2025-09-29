// api/stripeWebhook.js
import Stripe from "stripe";
import { google } from "googleapis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ quota mapping ตาม package
const PACKAGE_CONFIG = {
  lite: { quota: 5 },
  standard: { quota: 10 },
  premium: { quota: 30 },
};

// ✅ ปิด bodyParser เพื่อใช้ raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Helper: แปลง index → column name (รองรับเกิน Z เช่น AA, AB)
 */
function toColumnName(index) {
  let s = "";
  while (index >= 0) {
    s = String.fromCharCode((index % 26) + 65) + s;
    index = Math.floor(index / 26) - 1;
  }
  return s;
}

/**
 * updateUserQuota - update quota/expiry ใน Google Sheet
 */
async function updateUserQuota({ user_id, token, packageName, payment_intent_id, receipt_url }) {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const range = "Members!A:K";

  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values;
  const header = rows[0];

  const userIdIndex = header.indexOf("user_id");
  const tokenIndex = header.indexOf("token");

  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][userIdIndex] === user_id && rows[i][tokenIndex] === token) {
      rowIndex = i + 1; // Google Sheets index (1-based)
      break;
    }
  }

  if (rowIndex === -1) {
    console.error("❌ ไม่พบ user:", user_id);
    return false;
  }

  // ✅ quota/expiry ใหม่
  const quota = PACKAGE_CONFIG[packageName]?.quota || 0;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);
  const expiry = expiryDate.toISOString().split("T")[0];

  const packageIndex = header.indexOf("package");
  const quotaIndex = header.indexOf("quota");
  const expiryIndex = header.indexOf("expiry");
  const paymentIntentIndex = header.indexOf("payment_intent_id");
  const receiptUrlIndex = header.indexOf("receipt_url");
  const paidAtIndex = header.indexOf("paid_at");

  // ✅ ใช้ helper แปลง column index → A1 notation
  const startCol = toColumnName(packageIndex);
  const endCol = toColumnName(paidAtIndex);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Members!${startCol}${rowIndex}:${endCol}${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        packageName,
        quota,
        expiry,
        payment_intent_id,
        receipt_url,
        new Date().toISOString(),
      ]],
    },
  });

  return { quota, packageName, expiry };
}

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    // ✅ ตรวจสอบ webhook signature
    const buf = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });

    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const user_id = session.metadata?.user_id;
      const token = session.metadata?.token;
      const packageName = session.metadata?.packageName;

      const payment_intent_id = session.payment_intent;
      const receipt_url =
        session.invoice_url || session.invoice?.hosted_invoice_url || null;

      if (!user_id || !token || !packageName) {
        console.error("❌ Metadata missing in session:", session.id);
        return res.status(400).json({ success: false, message: "❌ Metadata missing" });
      }

      const updated = await updateUserQuota({
        user_id,
        token,
        packageName,
        payment_intent_id,
        receipt_url,
      });

      if (!updated) {
        return res.status(500).json({ success: false, message: "❌ Update quota failed" });
      }

      return res.json({
        success: true,
        message: "✅ การชำระเงินสำเร็จและสิทธิ์ถูกอัปเดตแล้วค่ะ",
        user_id,
        token,
        quota: updated.quota,
        package: updated.packageName,
        expiry: updated.expiry,
      });
    }

    // ✅ ตอบกลับ event อื่น (ignore)
    return res.json({ received: true });
  } catch (err) {
    console.error("❌ stripeWebhook failed:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
