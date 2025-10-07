// api/calcChart.js
// ✅ API endpoint สำหรับ Custom GPT เรียกคำนวณดวงดาวจริง
// ตัวนี้จะดึงข้อมูลจาก astrologyCoreCalc.js

import { calcAstroChart } from "../lib/astrologyCoreCalc.js";

export default async function handler(req, res) {
  try {
    const { date, time, lat, lng, zone } = req.body || req.query || {};

    if (!date || !time || !lat || !lng || !zone) {
      return res.status(400).json({
        status: "error",
        message: "กรุณาระบุ date, time, lat, lng, zone ให้ครบ"
      });
    }

    const chart = await calcAstroChart({
      date,
      time,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      zone
    });

    return res.status(200).json(chart);
  } catch (err) {
    console.error("❌ calcChart error:", err.message);
    return res.status(500).json({
      status: "error",
      message: "ไม่สามารถคำนวณดวงดาวได้: " + err.message
    });
  }
}
