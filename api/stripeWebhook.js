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

    // 🔹 ดึง email
    const email =
      intent.receipt_email ||
      intent.customer_email ||
      intent.charges?.data?.[0]?.billing_details?.email ||
      "";

    // 🔹 quota ตาม package
    const packageType = intent.metadata?.package || "unknown";
    let quota = 0;
    if (packageType.toLowerCase() === "lite") quota = 5;
    else if (packageType.toLowerCase() === "standard") quota = 10;
    else if (packageType.toLowerCase() === "premium") quota = 30;

    // 🔹 expiry = วันนี้ + 30 วัน
    const exp = new Date();
    exp.setDate(exp.getDate() + 30);
    const expiry = exp.toISOString().slice(0, 10); // YYYY-MM-DD

    // 🔹 gen user_id + token
    const userId = generateUserId();
    const token = generateToken();
    const nowIso = new Date().toISOString();

    // 🔹 ad
