// api/createCheckoutSession.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  try {
    // ✅ 1) รับเฉพาะ POST
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "❌ Method not allowed, ต้องใช้ POST เท่านั้น",
      });
    }

    const { user_id, token, packageName } = req.body || {};

    // ✅ 2) ตรวจสอบ input
    if (!user_id || !token || !packageName) {
      return res.status(400).json({
        success: false,
        message: "❌ ต้องส่ง user_id, token และ packageName",
      });
    }

    // ✅ 3) validate packageName
    const packageMap = {
      lite: { priceId: process.env.STRIPE_PRICE_LITE, quota: 10 },
      standard: { priceId: process.env.STRIPE_PRICE_STANDARD, quota: 30 },
      premium: { priceId: process.env.STRIPE_PRICE_PREMIUM, quota: 100 },
    };

    if (!packageMap[packageName]) {
      return res.status(400).json({
        success: false,
        message: "❌ packageName ไม่ถูกต้อง (lite, standard, premium)",
      });
    }

    // ✅ 4) สร้าง Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: packageMap[packageName].priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
      metadata: {
        user_id,
        token,
        packageName,
      },
    });

    // ✅ 5) ส่ง URL กลับ
    return res.status(200).json({
      success: true,
      checkout_url: session.url,
    });
  } catch (err) {
    console.error("❌ createCheckoutSession failed:", err.message);
    return res.status(500).json({
      success: false,
      message: "❌ ไม่สามารถสร้าง Checkout Session ได้",
      error: err.message,
    });
  }
}
