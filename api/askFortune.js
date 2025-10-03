// api/askFortune.js
import { findUser, updateUser } from "../lib/googleSheet.js";
import OpenAI from "openai";

// ✅ เตรียม client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ status: "error", message: "❌ ต้องใช้ POST เท่านั้น" });
  }

  try {
    const { user_id, token, question } = req.body || {};

    // ✅ ตรวจสอบ input
    if (!user_id || !token || !question) {
      return res.status(400).json({
        status: "error",
        message: "❌ ต้องส่ง user_id, token และ question",
      });
    }

    // ✅ ตรวจสอบ user ใน Google Sheet
    const user = await findUser(user_id, token);
    if (!user) {
      return res
        .status(401)
        .json({ status: "invalid", message: "❌ user_id หรือ token ไม่ถูกต้อง" });
    }

    // ✅ ตรวจสอบ package
    if (!user.package) {
      return res
        .status(401)
        .json({ status: "no_package", message: "❌ ยังไม่ได้ซื้อแพ็กเกจ" });
    }

    // ✅ ตรวจสอบ expiry
    if (user.expiry && new Date() > new Date(user.expiry)) {
      return res
        .status(401)
        .json({ status: "expired", message: "❌ สิทธิ์หมดอายุแล้ว" });
    }

    // ✅ ตรวจสอบ quota
    if (user.quota <= 0) {
      return res.status(401).json({
        status: "no_quota",
        message: "❌ สิทธิ์ของคุณหมดแล้ว กรุณาซื้อแพ็กเกจใหม่",
      });
    }

    // ✅ หัก quota
    const newQuota = user.quota - 1;
    const newUsedCount = (user.used_count || 0) + 1;
    const updated = await updateUser(
      user.user_id,
      user.token,
      newQuota,
      newUsedCount
    );

    if (!updated) {
      return res.status(500).json({
        status: "error",
        message: "❌ อัปเดต quota ไม่สำเร็จ",
      });
    }

    // ✅ สร้างคำทำนายจริงจาก OpenAI
    let fortuneAnswer = "";
    try {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini", // หรือเปลี่ยนเป็น model production ที่คุณต้องการ
        messages: [
          {
            role: "system",
            content:
              "คุณคือหมอดูโหราศาสตร์ไทย ให้คำทำนายที่กระชับ ชัดเจน และเป็นภาษาไทย",
          },
          { role: "user", content: question },
        ],
        temperature: 0.9, // เพิ่มความหลากหลายของคำตอบ
      });

      fortuneAnswer =
        completion.choices[0].message.content ||
        "🔮 ขอโทษค่ะ ระบบไม่สามารถทำนายได้ในขณะนี้";
    } catch (err) {
      console.error("❌ OpenAI error:", err);
      fortuneAnswer =
        "🔮 ขอโทษค่ะ ระบบไม่สามารถติดต่อบริการทำนายได้ กรุณาลองใหม่อีกครั้ง";
    }

    // ✅ ส่ง response กลับ
    const response = {
      status: "valid",
      remaining: newQuota,
      answer: fortuneAnswer,
    };

    if (newQuota < 3) {
      response.warning = `⚠️ เหลือสิทธิ์อีกเพียง ${newQuota} ครั้ง`;
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error("❌ askFortune failed:", err);
    return res.status(500).json({
      status: "error",
      message: "❌ ระบบไม่สามารถทำงานได้ กรุณาลองใหม่อีกครั้ง",
      error: err.message,
    });
  }
}
