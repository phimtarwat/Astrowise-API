// api/stripeWebhook.js
import Stripe from "stripe";
import { updateUser } from "../lib/googleSheet.js";
import { getPackageByAmount } from "../lib/packageConfig.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    console.log("✅ Stripe webhook received:", intent.id);

    // 🔹 ดึง user_id + token จาก metadata
    const userId = intent.metadata?.user_id;
    const token = intent.metadata?.token;

    if (!userId || !token) {
      console.error("❌ Missing user_id or token in Stripe metadata");
      return res.status(400).json({
        success: false,
        message: "❌ user_id หรือ token หายไปจาก metadata",
      });
    }

    // 🔹 quota/package จาก amount_received
    const { name: packageName, quota } = getPackageByAmount(
      intent.amount_received
    );
    console.log(
      "👉 Package mapped from amount:",
      packageName,
      "=> Quota:",
      quota
    );

    // 🔹 expiry = 30 วันจากวันชำระเงิน
    const exp = new Date();
    exp.setDate(exp.getDate() + 30);
    const expiry = exp.toISOString().slice(0, 10);

    console.log("👉 Expiry date set:", expiry);

    // 🔹 update user เดิมใน Google Sheet
    const ok = await updateUser({
      userId,
      token,
      quota,
      packageName,
      expiry,
      payment_intent_id: intent.id,
      receipt_url: intent.charges?.data?.[0]?.receipt_url || null,
      paid_at: new Date().toISOString(),
    });

    if (!ok) {
      console.error("❌ updateUser failed for user:", { userId, token });
      return res.status(500).json({
        success: false,
        message: "❌ updateUser failed",
      });
    }

    console.log("✅ updateUser success for user:", { userId, token });

    // ✅ ตอบ Stripe
    return res.json({
      success: true,
      message: "✅ การชำระเงินสำเร็จและสิทธิ์ถูกอัปเดตแล้วค่ะ",
      user_id: userId,
      token,
      quota,
      package: packageName,
      expiry,
    });
  }

  return res.json({ received: true });
}
