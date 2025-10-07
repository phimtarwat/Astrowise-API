// api/createCheckoutSession.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * API: /api/createCheckoutSession
 * สร้าง Stripe Checkout Session สำหรับซื้อแพ็กเกจสมาชิก
 */
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

    // ✅ 3) ตรวจค่า Stripe ENV ครบหรือไม่
    if (
      !process.env.STRIPE_SECRET_KEY ||
      !process.env.STRIPE_PRICE_LITE ||
      !process.env.STRIPE_PRICE_STANDARD ||
      !process.env.STRIPE_PRICE_PREMIUM
    ) {
      return res.status(500).json({
        success: false,
        message: "❌ ยังไม่ได้ตั้งค่า Stripe environment variable ให้ครบ",
      });
    }

    // ✅ 4) กำหนดแพ็กเกจและ quota
    const packageMap = {
      lite: { priceId: process.env.STRIPE_PRICE_LITE, quota: 10, label: "Lite" },
      standard: { priceId: process.env.STRIPE_PRICE_STANDARD, quota: 30, label: "Standard" },
      premium: { priceId: process.env.STRIPE_PRICE_PREMIUM, quota: 100, label: "Premium" },
    };

    if (!packageMap[packageName]) {
      return res.status(400).json({
        success: false,
        message: "❌ packageName ไม่ถูกต้อง (ต้องเป็น lite, standard, หรือ premium)",
      });
    }

    // ✅ 5) base URL (รองรับทั้ง dev และ prod)
    const baseUrl =
      process.env.BASE_URL ||
      (req.headers.origin
        ? req.headers.origin
        : "https://your-app-name.vercel.app");

    // ✅ 6) สร้าง Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: packageMap[packageName].priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
      metadata: {
        user_id,
        token,
        packageName,
        quota: packageMap[packageName].quota,
        origin: baseUrl,
        createdAt: new Date().toISOString(),
      },
    });

    // ✅ 7) ส่งข้อมูลกลับไปให้ client
    return res.status(200).json({
      success: true,
      checkout_url: session.url,
      package: {
        name: packageMap[packageName].label,
        quota: packageMap[packageName].quota,
      },
    });
  } catch (err) {
    console.error("❌ createCheckoutSession failed:", err.message);

    // ✅ ระบุ status code ที่เหมาะสม
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: "❌ ไม่สามารถสร้าง Checkout Session ได้",
      error: err.message,
    });
  }
}
