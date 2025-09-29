// api/askFortune.js
import { getUser, updateUser } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  const { user_id, token, question } = req.body;

  const user = await getUser(user_id, token);
  if (!user) {
    return res.status(401).json({ error: "invalid", message: "❌ user_id หรือ token ไม่ถูกต้อง" });
  }

  if (!user.packageName || user.quota - user.used_count <= 0) {
    return res.status(401).json({
      error: "no_quota",
      message: "❌ สิทธิ์ของคุณหมดแล้ว กรุณาซื้อแพ็กเกจใหม่ค่ะ"
    });
  }

  await updateUser({ userId: user.userId, used_count: user.used_count + 1 });

  return res.json({
    success: true,
    remaining: user.quota - user.used_count - 1,
    answer: `🔮 คำทำนายสำหรับคำถาม "${question}" คือ...`
  });
}
