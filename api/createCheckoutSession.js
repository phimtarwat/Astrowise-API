// api/createCheckoutSession.js
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      status: "error",
      message: "❌ ต้องใช้ POST เท่านั้น",
    });
  }

  try {
    let { user_id, token, packageName } = req.body || {};
    if (!user_id || !token || !packageName) {
      return res.status(400).json({
        status: "error",
        message: "❌ ต้องส่ง user_id, token และ packageName",
      });
    }

    // ✅ normalize ให้เป็นตัวเล็กเสมอ
    packageName = packageName.toLowerCase();

    const packageMap = {
      lite: process.env.STRIPE_PRICE_LITE,
      standard: process.env.STRIPE_PRICE_STANDARD,
      premium: process.env.STRIPE_PRICE_PREMIUM,
    };

    if (!packageMap[packageName]) {
      return res.status(400).json({
        status: "error",
        message: `❌ packageName ไม่ถูกต้อง (ส่งมา: ${packageName})`,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: packageMap[packageName], quantity: 1 }],
      success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
      metadata: { user_id, token, packageName },
          });

    // ✅ ตอบกลับตรงตาม OpenAPI spec
    return res.status(200).json({
      status: "valid",
      checkout_url: session.url,
    });
  } catch (err) {
    console.error("❌ createCheckoutSession failed:", err);
    return res.status(500).json({
      status: "error",
      message: "❌ ไม่สามารถสร้าง Checkout Session ได้",
      error: err.message,
    });
  }
}
