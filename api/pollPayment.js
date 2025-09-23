// api/pollPayment.js
export default async function handler(req, res) {
  const { paymentIntentId } = req.query;

  if (!paymentIntentId) {
    return res.status(400).json({
      error: "missing_paymentIntentId",
      message: "❌ ต้องส่ง paymentIntentId มาด้วย",
    });
  }

  let attempt = 0;
  const maxAttempts = 10;   // ลองสูงสุด 10 ครั้ง
  const delayMs = 3000;     // ทุก 3 วิ

  async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  for (attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await fetch(
        `${process.env.API_BASE_URL}/api/getLatestUser?paymentIntentId=${paymentIntentId}`
      );
      const data = await resp.json();

      if (data.status === "paid") {
        return res.json({
          success: true,
          message: `✅ การชำระเงินสำเร็จแล้วค่ะ\nuser_id=${data.userId}, token=${data.token} (${data.package}, quota ${data.quota} ครั้ง)\nหมดอายุ: ${data.expiry}`,
          details: data,
        });
      }

      // ยังไม่เจอ → pending → รอต่อ
      await wait(delayMs);
    } catch (err) {
      console.error("❌ pollPayment error:", err.message);
      break;
    }
  }

  return res.status(408).json({
    success: false,
    message: "❌ ไม่พบข้อมูลการชำระเงินในเวลาที่กำหนด กรุณาลองใหม่ค่ะ",
  });
}
