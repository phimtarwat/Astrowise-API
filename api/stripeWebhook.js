// api/stripeWebhook.js
import Stripe from "stripe";
import { google } from "googleapis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export const config = { api: { bodyParser: false } };

async function updateUserQuota({ user_id, token, packageName, payment_intent_id, receipt_url }) {
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
    if (!rows || rows.length === 0) return false;

    const header = rows[0];
    const userIdIndex = header.indexOf("user_id");
    const tokenIndex = header.indexOf("token");

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][userIdIndex] === user_id && rows[i][tokenIndex] === token) {
        rowIndex = i + 1; // +1 เพราะ header อยู่แถวแรก
        break;
      }
    }
    if (rowIndex === -1) return false;

    // ✅ normalize packageName
    const normalized = packageName.toLowerCase();

    // ✅ ใช้ quota map เดียวกับ packageConfig.js
    const quotaMap = { lite: 5, standard: 10, premium: 30 };
    const quota = quotaMap[normalized] || 0;
    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 วัน
      .toISOString()
      .split("T")[0];

    // ✅ update E..K (package → paid_at)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Members!E${rowIndex}:K${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          normalized, // E: package
          quota,      // F: quota
          expiry,     // G: expiry
          payment_intent_id, // H: payment_intent_id
          receipt_url,       // I: receipt_url
          new Date().toISOString(), // J: paid_at
        ]],
      },
    });

    return { quota, package: normalized, expiry };
  } catch (err) {
    console.error("❌ updateUserQuota failed:", err.message);
    return false;
  }
}

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
    const { user_id, token, packageName } = session.metadata || {};

    if (!user_id || !token || !packageName) {
      console.error("❌ Metadata missing:", session.metadata);
      return res.status(400).json({ status: "error", message: "❌ Metadata missing" });
    }

    // ✅ ดึง receipt_url จาก PaymentIntent โดยตรง
    let receipt_url = null;
    try {
      if (session.payment_intent) {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
          expand: ["charges.data.receipt_url"],
        });
        receipt_url = pi.charges?.data?.[0]?.receipt_url || null;
      }
    } catch (err) {
      console.warn("⚠️ Cannot fetch paymentIntent:", err.message);
    }

    const updated = await updateUserQuota({
      user_id,
      token,
      packageName,
      payment_intent_id: session.payment_intent,
      receipt_url,
    });

    if (!updated) {
      return res.status(500).json({ status: "error", message: "❌ Update quota failed" });
    }

    return res.json({
      status: "valid",
      message: "✅ สิทธิ์ถูกอัปเดตเรียบร้อยแล้ว",
      user_id,
      token,
      quota: updated.quota,
      package: updated.package,
      expiry: updated.expiry,
    });
  }

  return res.json({ received: true }); // ignore event อื่น
}
