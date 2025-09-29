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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("✅ Stripe webhook received:", session.id);

    const userId = session.metadata?.user_id;
    const token = session.metadata?.token;

    if (!userId || !token) {
      console.error("❌ Missing user_id/token in metadata");
      return res.status(400).json({ success: false });
    }

    // quota/package จาก amount_total (หรือ mapping จาก priceId)
    const { name: packageName, quota } = getPackageByAmount(
      session.amount_total
    );

    const exp = new Date();
    exp.setDate(exp.getDate() + 30);
    const expiry = exp.toISOString().slice(0, 10);

    const ok = await updateUser({
      userId,
      token,
      quota,
      packageName,
      expiry,
      payment_intent_id: session.payment_intent,
      receipt_url: session.payment_status === "paid" ? session.url : null,
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
