// api/createCheckoutSession.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { user_id, token, packageName } = req.body;

  if (!user_id || !token || !packageName) {
    return res.status(400).json({
      success: false,
      message: "❌ missing fields: ต้องส่ง user_id, token, packageName",
    });
  }

  // mapping package → Stripe price ID
  const priceMap = {
    lite: "price_1S8FjEKBKfkzmqyipUNaXIow",      // ใส่ Price ID ของคุณจาก Stripe Dashboard
    standard: "price_1S8FkRKBKfkzmqyizRRfY5XX",
    premium: "price_1S8FmmKBKfkzmqyiN75u0Xfs",
  };

  const priceId = priceMap[packageName];
  if (!priceId) {
    return res.status(400).json({
      success: false,
      message: "❌ packageName ไม่ถูกต้อง",
    });
  }

  try {
    // สร้าง Checkout Session พร้อม metadata
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${process.env.BASE_URL}/success`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
      metadata: {
        user_id,
        token,
      },
    });

    return res.json({
      success: true,
      checkout_url: session.url,
    });
  } catch (err) {
    console.error("❌ createCheckoutSession error:", err.message);
    return res.status(500).json({
      success: false,
      message: "❌ ไม่สามารถสร้าง Checkout Session ได้",
      error: err.message,
    });
  }
}

