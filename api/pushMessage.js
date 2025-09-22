// api/pushMessage.js
export default async function handler(req, res) {
  const { user_id, token, quota, packageName } = req.body;

  if (!user_id || !token) {
    return res.status(400).json({ error: "missing user_id or token" });
  }

  return res.json({
    success: true,
    message: `✅ การชำระเงินสำเร็จแล้วค่ะ
user_id=${user_id}, token=${token} (${packageName}, quota ${quota} ครั้ง)`
  });
}

