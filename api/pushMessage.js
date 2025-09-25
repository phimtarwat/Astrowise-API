// api/pushMessage.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { user_id, token, quota, package: packageName, expiry } = req.body;

  if (!user_id || !token || !quota || !packageName || !expiry) {
    return res.status(400).json({
      success: false,
      message:
        "❌ missing fields: ต้องส่ง user_id, token, quota, package, expiry",
    });
  }

  // ✅ ข้อความสำหรับผู้ใช้ (เน้น user_id และ token)
  const userMessage =
    `✅ การชำระเงินสำเร็จ\n\n` +
    `🔑 โปรดบันทึกข้อมูลนี้ไว้สำหรับการใช้งาน\n` +
    `\`\`\`\nuser_id = ${user_id}\ntoken   = ${token}\n\`\`\`\n\n` +
    `📦 แพ็กเกจ: ${packageName}\n` +
    `🎟️ สิทธิ์ที่ได้รับ: ${quota} ครั้ง\n` +
    `⏳ ใช้ได้ถึง: ${expiry}\n\n` +
    `คุณสามารถใช้ user_id และ token นี้ในการเข้าใช้งานระบบได้ ✨`;

  return res.json({
    success: true,
    user_visible_message: userMessage,
  });
}
