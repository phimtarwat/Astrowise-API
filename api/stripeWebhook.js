// api/stripeWebhook.js
import Stripe from "stripe";
import { addUser } from "../lib/googleSheet.js";
import { generateUserId, generateToken } from "../lib/token.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: { bodyParser: false }
};

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
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
    const paymentIntent = event.data.object;
    console.log("✅ Stripe webhook received:", paymentIntent.id);

    const email = paymentIntent.receipt_email || "unknown";
    const packageType = paymentIntent.metadata?.package || "Unknown";
    let quota = 0;

    if (packageType === "Lite") quota = 5;
    else if (packageType === "Standard") quota = 10;
    else if (packageType === "Premium") quota = 30;
    else {
      console.warn("⚠️ Unknown packageType:", packageType);
    }

    const userId = generateUserId();
    const token = generateToken();
    console.log("👉 Generating new user:", { userId, token, quota });

    try {
      const success = await addUser({
        userId,
        token,
        email,
        quota,
        payment_intent_id: paymentIntent.id,
        paid_at: new Date().toISOString(),
      });

      if (!success) {
        console.error("❌ Failed to add user to Google Sheet");
      } else {
        console.log("✅ User added to Google Sheet:", userId, token);
      }
    } catch (err) {
      console.error("❌ Error in addUser:", err.message, err);
    }

    return res.json({
      success: true,
      message: "✅ การชำระเงินสำเร็จแล้วค่ะ",
      user_id: userId,
      token,
      quota,
      package: packageType,
    });
  }

  res.json({ received: true });
}
