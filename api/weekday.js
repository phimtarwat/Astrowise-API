// api/weekday.js
import { getWeekdayStrict } from "../lib/utils/weekdayStrict.js";

export default async function handler(req, res) {
  try {
    const date = (req.query.date || req.body?.date || "").trim();
    if (!date) {
      return res.status(400).json({ status: "error", message: "ต้องส่ง ?date=" });
    }

    const out = getWeekdayStrict(date);
    return res.status(200).json(out);
  } catch (err) {
    console.error("❌ weekday error:", err.message);
    return res.status(400).json({ status: "error", message: err.message });
  }
}
