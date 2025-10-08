// api/gptHandler.js
import fetch from "node-fetch";

/**
 * ✅ Internal Relay สำหรับ Custom GPT
 * รวมทุก API endpoint ของ Astrowise ไว้ในจุดเดียว
 * GPT จะเรียก endpoint นี้แทนการยิง API ภายนอกโดยตรง
 */

const routeMap = {
  askFortune: { path: "/api/askFortune", method: "POST" },
  checkToken: { path: "/api/checkToken", method: "GET" },
  createCheckoutSession: { path: "/api/createCheckoutSession", method: "POST" },
  calcChart: { path: "/api/calcChart", method: "POST" },
};

export default async function handler(req, res) {
  try {
    // ✅ อนุญาตเฉพาะ POST จาก GPT
    if (req.method !== "POST") {
      return res.status(405).json({
        status: "error",
        message: "❌ ต้องใช้ POST เท่านั้น",
      });
    }

    const { route, payload } = req.body || {};

    if (!route || !routeMap[route]) {
      return res.status(400).json({
        status: "error",
        message: `❌ route ไม่ถูกต้อง หรือไม่ได้ระบุ: ${route}`,
      });
    }

    const baseURL =
      process.env.ASTROWISE_API_BASE_URL || "https://astrowise-api.vercel.app";
    const { path, method } = routeMap[route];
    let targetURL = `${baseURL}${path}`;
    let fetchOptions = { method, headers: { "Content-Type": "application/json" } };

    // ✅ ถ้าเป็น GET (ใช้กับ /api/checkToken)
    if (method === "GET") {
      const query = new URLSearchParams(payload || {}).toString();
      targetURL += `?${query}`;
      delete fetchOptions.headers; // ไม่ต้องใช้ header JSON
    } else {
      // ✅ POST (askFortune, createCheckoutSession, calcChart)
      fetchOptions.body = JSON.stringify(payload || {});
    }

    console.log(`🔁 gptHandler → ${method} ${targetURL}`);

    // ✅ เรียกไปยัง API จริง
    const response = await fetch(targetURL, fetchOptions);
    const data = await response.json();

    // ✅ ส่งต่อผลลัพธ์กลับให้ GPT
    return res.status(response.status).json(data);
  } catch (err) {
    console.error("❌ gptHandler error:", err.message);
    return res.status(500).json({
      status: "error",
      message: "❌ Internal relay error: " + err.message,
    });
  }
}
