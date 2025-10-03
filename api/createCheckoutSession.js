// api/createCheckoutSession.js
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16", // ใช้ API เวอร์ชันล่าสุด
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ status: "error", message: "❌ ต้องใช้ POST เท่านั้น" });
  }

  try {
    let { user_id, token, packageName } = req.body || {};

    // ✅ ตรวจสอบ input
    if (!user_id || !token || !packageName) {
      return res.status(400).json({
        status: "error",
        message: "❌ ต้องส่ง user_id, token และ packageName",
      });
    }

    // ✅ normalize packageName
    packageName = String(packageName).toLowerCase();

    // ✅ map packageName → price ID
    const packageMap = {
      lite: process.env.STRIPE_PRICE_LITE,
      standard: process.env.STRIPE_PRICE_STANDARD,
      premium: process.env.STRIPE_PRICE_PREMIUM,
    };

    const priceId = packageMap[packageName];

    if (!priceId) {
      console.error("❌ Invalid packageName:", packageName, packageMap);
      return res.status(400).json({
        status: "error",
        message: `❌ packageName ไม่ถูกต้อง (ส่งมา: ${packageName})`,
      });
    }

    // ✅ Debug log
    console.log("👉 DEBUG createCheckoutSession:", {
      user_id,
      token,
      packageName,
      priceId,
      BASE_URL: process.env.BASE_URL,
      STRIPE_SECRET_KEY_PREFIX: process.env.STRIPE_SECRET_KEY?.slice(0, 10),
    });

    // ✅ สร้าง Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"], // เพิ่มให้แน่นอนว่ามี card
      line_items: [
        {
          price: priceId,
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
      // ❗ ถ้า account Stripe เก่าอาจใช้ไม่ได้ → ลองคอมเมนต์ออกถ้า error
      automatic_payment_methods: { enabled: true },
    });

    // ✅ ตอบกลับตาม spec
    return res.status(200).json({
      status: "valid",
      checkout_url: session.url,
    });
  } catch (err) {
    console.error("❌ createCheckoutSession failed FULL ERROR:", err);

    // ✅ ถ้า Stripe ส่ง error แบบเจาะจงมา
    let debugInfo = {};
    if (err.raw) {
      debugInfo = {
        type: err.raw.type,
        code: err.raw.code,
        param: err.raw.param,
        message: err.raw.message,
      };
    }

    return res.status(500).json({
      status: "error",
      message: "❌ ไม่สามารถสร้าง Checkout Session ได้",
      error: err.message,
      debug: debugInfo,
    });
  }
}
