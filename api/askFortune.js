// api/askFortune.js
import { findUser, updateUser } from "../lib/googleSheet.js";
import { google } from "googleapis";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // ต้องเซ็ต ENV KEY ให้เรียบร้อย
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "❌ ต้องใช้ POST" });
  }

  const { user_id, token, question } = req.body || {};
  if (!user_id || !token || !question) {
    return res
      .status(400)
      .json({ status: "error", message: "❌ input ไม่ครบ" });
  }

  const user = await findUser(user_id, token);
  if (!user) {
    return res
      .status(401)
      .json({ status: "invalid", message: "❌ user_id หรือ token ไม่ถูกต้อง" });
  }

  if (!user.package) {
    return res
      .status(401)
      .json({ status: "no_package", message: "❌ ยังไม่ได้ซื้อแพ็กเกจ" });
  }

  if (user.expiry && new Date() > new Date(user.expiry)) {
    return res
      .status(401)
      .json({ status: "expired", message: "❌ สิทธิ์หมดอายุแล้ว" });
  }

  if (user.quota <= 0) {
    return res
      .status(401)
      .json({ status: "no_quota", message: "❌ สิทธิ์ของคุณหมดแล้ว" });
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
    return res
      .status(500)
      .json({ status: "error", message: "❌ อัปเดต quota ไม่สำเร็จ" });
  }

  // ✅ ใช้ OpenAI สร้างคำทำนายจริง
  let fortuneAnswer = "";
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // หรือเลือก model อื่นที่คุณเปิดใช้งาน
      messages: [
        {
          role: "system",
          content:
            "คุณเป็นหมอดูโหราศาสตร์ไทย ผู้เชี่ยวชาญเรื่องการดูดวง, เลขมงคล, วันดี, โชคลาภ ให้คำตอบเป็นภาษาไทย",
        },
        { role: "user", content: question },
      ],
    });

    fortuneAnswer = completion.choices[0].message.content || "🔮 ไม่สามารถทำนายได้";
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    fortuneAnswer = "🔮 ขอโทษค่ะ ระบบไม่สามารถทำนายได้ในขณะนี้";
  }

  // ✅ ส่ง response กลับ
  const response = {
    status: "valid",
    remaining: newQuota,
    answer: fortuneAnswer,
  };
  if (newQuota < 3)
    response.warning = `⚠️ เหลือสิทธิ์อีกเพียง ${newQuota} ครั้ง`;

  return res.status(200).json(response);
}
