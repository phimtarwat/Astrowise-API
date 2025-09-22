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

    // ดึงข้อมูลให้ครบ (เอา receipt_url)
    let receipt_url = "";
    try {
      const pi = await stripe.paymentIntents.retrieve(intent.id, { expand: ["latest_charge"] });
      if (pi?.latest_charge && typeof pi.latest_charge === "object") {
        receipt_url = pi.latest_charge.receipt_url || "";
      }
    } catch (e) {
      console.warn("⚠️ cannot fetch receipt_url:", e.message);
    }

    const email = intent.receipt_email || "";
    const rawPkg = intent.metadata?.package || "Unknown";
    const packageName = rawPkg.toLowerCase(); // ให้ตรงกับชีท (lite/standard/premium)

    let quota = 0;
    if (packageName === "lite") quota = 5;
    else if (packageName === "standard") quota = 10;
    else if (packageName === "premium") quota = 30;
    else console.warn("⚠️ Unknown package:", rawPkg);

    // expiry = 1 ปีนับจากวันนี้ (ปรับตามนโยบายได้)
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 1);
    const expiry = exp.toISOString().slice(0, 10); // YYYY-MM-DD

    const userId = generateUserId();  // 5 หลัก
    const token = generateToken();    // 5 หลัก
    const nowIso = new Date().toISOString();

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
      expiry,
      receipt_url,
    });
  }

  return res.json({ received: true });
}
