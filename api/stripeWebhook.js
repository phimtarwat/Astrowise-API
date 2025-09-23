// api/stripeWebhook.js
import Stripe from "stripe";
import { addUser } from "../lib/googleSheet.js";
import { generateUserId, generateToken } from "../lib/token.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    console.log("✅ Stripe webhook received:", intent.id);

    // 🔹 ดึง receipt_url
    let receipt_url = "";
    try {
      const pi = await stripe.paymentIntents.retrieve(intent.id, { expand: ["latest_charge"] });
      if (pi?.latest_charge && typeof pi.latest_charge === "object") {
        receipt_url = pi.latest_charge.receipt_url || "";
      }
    } catch (e) {
      console.warn("⚠️ cannot fetch receipt_url:", e.message);
    }

    // 🔹 ดึง email (เผื่อ receipt_email ว่าง)
    const email =
      intent.receipt_email ||
      intent.customer_email ||
      intent.charges?.data?.[0]?.billing_details?.email ||
      "";

    // 🔹 quota ตาม package
    const rawPkg = intent.metadata?.package || "unknown";
    const packageName = rawPkg.toLowerCase();
    let quota = 0;
    if (packageName === "lite") quota = 5;
    else if (packageName === "standard") quota = 10;
    else if (packageName === "premium") quota = 30;
    else console.warn("⚠️ Unknown package:", rawPkg);

    // 🔹 expiry = 30 วันจากวันชำระเงิน
    const exp = new Date();
    exp.setDate(exp.getDate() + 30);
    const expiry = exp.toISOString().slice(0, 10); // YYYY-MM-DD

    // 🔹 gen user_id + token
    const userId = generateUserId();  // 5 หลัก
    const token = generateToken();    // 5 หลัก
    const nowIso = new Date().toISOString();

    // 🔹 บันทึกลง Google Sheet
    const ok = await addUser({
      userId,
      token,
      expiry,
      quota,
      used_count: 0,
      packageName,
      email,
      created_at: nowIso,
      payment_intent_id: intent.id,
      receipt_url,
      paid_at: nowIso,
    });

    if (!ok) console.error("❌ addUser failed");

    return res.json({
      success: true,
      message: "✅ การชำระเงินสำเร็จแล้วค่ะ",
      user_id: userId,
      token,
      quota,
      package: packageName,
      email,
      expiry,
      receipt_url,
    });
  }

  return res.json({ received: true });
}
