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
    const { user_id, token, packageName } = req.body || {};
    if (!user_id || !token || !packageName) {
      return res.status(400).json({
        status: "error",
        message: "❌ ต้องส่ง user_id, token และ packageName",
      });
    }

    // ✅ Mapping Price IDs จาก ENV
    const packageMap = {
      lite: process.env.STRIPE_PRICE_LITE,
      standard: process.env.STRIPE_PRICE_STANDARD,
      premium: process.env.STRIPE_PRICE_PREMIUM,
    };

    if (!packageMap[packageName]) {
      return res.status(400).json({
        status: "error",
        message: "❌ packageName ไม่ถูกต้อง (lite, standard, premium)",
      });
    }

    console.log("👉 Creating checkout session with:", {
      packageName,
      priceId: packageMap[packageName],
      user_id,
      token,
    });

    // ✅ Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: packageMap[packageName], quantity: 1 }],
      success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
      metadata: { user_id, token, packageName }, // สำคัญมาก
      automatic_payment_methods: { enabled: true },
    });

    console.log("✅ Stripe session created:", session);

    // ✅ ต้องใช้ session.url เท่านั้น
    return res.status(200).json({
      status: "valid",
      checkout_url: session.url,
      debug: {
        id: session.id,
        url: session.url,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
      },
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
