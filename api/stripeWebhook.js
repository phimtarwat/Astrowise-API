// api/stripeWebhook.js
import Stripe from "stripe";
import { updateUser } from "../lib/googleSheet.js";
import { getPackageByAmount } from "../lib/packageConfig.js";

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
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;

    const { name: packageName, quota } = getPackageByAmount(intent.amount_received);
    const exp = new Date();
    exp.setDate(exp.getDate() + 30);
    const expiry = exp.toISOString().slice(0, 10);

    const email = intent.charges?.data?.[0]?.billing_details?.email || null;

    // อัปเดต user เดิมที่สมัครไว้
    const ok = await updateUser({
      email,
      quota,
      packageName,
      expiry,
      payment_intent_id: intent.id,
      receipt_url: intent.charges?.data?.[0]?.receipt_url || null,
      paid_at: new Date().toISOString()
    });

    if (!ok) {
      return res.status(500).json({ success: false, message: "❌ activate user failed" });
    }

    return res.json({ success: true, message: "✅ User activated", email, packageName, quota });
  }

  return res.json({ received: true });
}
