// api/gptHandler.js
import fetch from "node-fetch"; // ✅ fallback สำหรับ Node.js ESM

/**
 * ✅ Internal Relay สำหรับ Custom GPT
 * GPT จะเรียก endpoint นี้แทนการยิง API ภายนอกโดยตรง
 * เพื่อหลีกเลี่ยง popup ยืนยันสิทธิ์
 */

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        status: "error",
        message: "❌ ต้องใช้ POST เท่านั้น",
      });
    }

    const { route, payload } = req.body || {};

    if (!route) {
      return res.status(400).json({
        status: "error",
        message: "❌ ต้องระบุ route (เช่น askFortune, fortuneProxy, createCheckoutSession)",
      });
    }

    const routeMap = {
      askFortune: "/api/askFortune",
      fortuneProxy: "/api/fortuneProxy",
      createCheckoutSession: "/api/createCheckoutSession",
      calcChart: "/api/calcChart"
    };

    const targetPath = routeMap[route];
    if (!targetPath) {
      return res.status(400).json({
        status: "error",
        message: `❌ route "${route}" ไม่ถูกต้อง`,
      });
    }

    const baseURL = process.env.ASTROWISE_API_BASE_URL || "https://astrowise-api.vercel.app";
    const targetURL = `${baseURL}${targetPath}`;

    console.log(`🔁 gptHandler → ${targetURL}`);

    const response = await fetch(targetURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });

    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (err) {
    console.error("❌ gptHandler error:", err.message);
    return res.status(500).json({
      status: "error",
      message: "❌ Internal relay error: " + err.message,
    });
  }
}
