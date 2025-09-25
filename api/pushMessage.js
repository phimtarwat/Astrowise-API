// api/pushMessage.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { user_id, token, quota, package: packageName } = req.body;

  if (!user_id || !token || !quota || !packageName) {
    return res.status(400).json({
      success: false,
      message: "❌ missing fields: ต้องส่ง user_id, token, quota, package",
    });
  }

  // ✅ ข้อความสำหรับผู้ใช้
  const userMessage = `✅ การชำระเงินสำเร็จแล้ว\n\n` +
    `🔑 user_id = **${user_id}**\n` +
    `🔑 token = **${token}**\n\n` +
    `📦 แพ็กเกจ: ${packageName}\n` +
    `🎟️ สิทธิ์ที่ได้รับ: ${quota} ครั้ง\n\n` +
    `คุณสามารถนำ user_id และ token นี้ใช้ในการเข้าระบบเลยครับ ✨`;

  // ✅ ตอบกลับให้ระบบ (จะถูกส่งต่อไปยัง Chat โดยอัตโนมัติ)
  return res.json({
    success: true,
    user_visible_message: userMessage,
  });
}
