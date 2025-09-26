// api/stripeWebhook.js
import Stripe from "stripe";
import { addUser } from "../lib/googleSheet.js";
import { generateUserId, generateToken } from "../lib/token.js";
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

    // 🔹 ดึง receipt_url
    let receipt_url = "";
    try {
      const pi = await stripe.paymentIntents.retrieve(intent.id, {
        expand: ["latest_charge"],
      });
      if (pi?.latest_charge && typeof pi.latest_charge === "object") {
        receipt_url = pi.latest_charge.receipt_url || "";
      }
    } catch (e) {
      console.warn("⚠️ cannot fetch receipt_url:", e.message);
    }

    // 🔹 ดึง email (fallback หลายแบบ)
    const email =
      intent.receipt_email ||
      intent.customer_email ||
      intent.charges?.data?.[0]?.billing_details?.email ||
      "";
    console.log("👉 Email resolved:", email);

    // 🔹 quota/package จาก amount_received
    const { name: packageName, quota } = getPackageByAmount(
      intent.amount_received
    );
    console.log("👉 Package mapped from amount:", packageName, "=> Quota:", quota);

    // 🔹 expiry = 30 วันจากวันชำระเงิน
    const exp = new Date();
    exp.setDate(exp.getDate() + 30);
    const expiry = exp.toISOString().slice(0, 10);
    console.log("👉 Expiry date set:", expiry);

    // 🔹 gen user_id + token
    const userId = generateUserId();
    const token = generateToken();
    const nowIso = new Date().toISOString();

    console.log("👉 addUser payload:", {
      userId,
      token,
      expiry,
      quota,
      packageName,
      email,
    });

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

    if (!ok) {
      console.error("❌ addUser failed to write Google Sheet");
    } else {
      console.log("✅ addUser success, user written to Google Sheet");

      // 🔹 Push message กลับไปที่ GPT Chat
      try {
        const baseUrl =
          process.env.BASE_URL || "https://astrowise-api.vercel.app"; // fallback
        const resp = await fetch(`${baseUrl}/api/pushMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            token,
            quota,
            package: packageName,
            expiry,
          }),
        });

        if (!resp.ok) {
          throw new Error(`pushMessage failed with status ${resp.status}`);
        }

        const data = await resp.json();
        console.log("✅ pushMessage response:", data);
      } catch (err) {
        console.error("❌ Failed to pushMessage:", err.message);
      }
    }

    // ✅ ตอบ Stripe กลับไปตามปกติ
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
