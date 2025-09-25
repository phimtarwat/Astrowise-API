/api/pollPayment:
  get:
    operationId: pollPayment
    summary: Poll ตรวจสอบสถานะการจ่ายเงิน
    description: |
      ใช้รอผลการชำระเงินจาก Stripe  
      ถ้า status=paid จะได้ user_id + token กลับมา
    parameters:
      - name: paymentIntentId
        in: query
        required: true
        schema: { type: string }
        example: "pi_3SAxxxx"
    responses:
      "200":
        description: พบข้อมูลการชำระเงินแล้ว
        content:
          application/json:
            schema:
              type: object
              properties:
                success: { type: boolean, example: true }
                message: { type: string, example: "✅ ชำระเงินสำเร็จ" }
                details:
                  type: object
                  properties:
                    userId: { type: string, example: "12345" }
                    token: { type: string, example: "67890" }
                    package: { type: string, example: "standard" }
                    quota: { type: integer, example: 10 }
                    expiry: { type: string, format: date, example: "2025-10-23" }
                user_visible_message:
                  type: string
                  example: |
                    ✅ การชำระเงินสำเร็จแล้วค่ะ
                    🔑 โปรดบันทึกข้อมูลนี้ไว้สำหรับการใช้งาน
                    ```
                    user_id = 12345
                    token   = 67890
                    ```
                    
                    📦 แพ็กเกจ: standard
                    🎟️ สิทธิ์ที่ได้รับ: 10 ครั้ง
                    ⏳ ใช้ได้ถึง: 2025-10-23
      "408":
        description: ยังไม่พบข้อมูลการชำระเงิน
        content:
          application/json:
            schema:
              type: object
              properties:
                success: { type: boolean, example: false }
                message: { type: string, example: "⌛ ยังไม่พบข้อมูลการชำระเงิน" }
