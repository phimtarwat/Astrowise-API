// lib/utils/convertToThaiDate.js
// แปลงวันที่และเวลาเกิดจากประเทศต้นทาง → เวลาไทย (Asia/Bangkok)
// ใช้ได้ทั้งกรณีผู้ใช้เกิดในไทยหรือเกิดต่างประเทศ
// รองรับ timezone มาตรฐานสากล (IANA Time Zone เช่น America/New_York, Asia/Tokyo)

import { DateTime } from "luxon";

/**
 * แปลงวันเวลาเกิดจากประเทศต้นทาง → เวลาไทย
 * @param {string} dateStr - วันที่ในรูปแบบ ISO เช่น "1971-11-17" หรือ "2025-03-05"
 * @param {string} timeStr - เวลาในรูปแบบ "HH:mm" หรือ "HH:mm:ss"
 * @param {string} sourceZone - โซนเวลาต้นทาง เช่น "America/New_York", "Asia/Tokyo"
 * @returns {object} { isoThai, dateThai, timeThai, weekdayTh }
 */
export function convertToThaiDate(dateStr, timeStr = "00:00", sourceZone = "Asia/Bangkok") {
  try {
    // ✅ รวมวันเวลาเป็น ISO string เช่น 1971-11-17T23:00
    const src = DateTime.fromISO(`${dateStr}T${timeStr}`, { zone: sourceZone });

    if (!src.isValid) {
      throw new Error("❌ รูปแบบวันเวลาไม่ถูกต้อง หรือ timezone ไม่รองรับ");
    }

    // ✅ แปลงเป็นเวลาไทย (Asia/Bangkok)
    const th = src.setZone("Asia/Bangkok");

    // ✅ ดึงชื่อวันภาษาไทย
    const weekdayThMap = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
    const weekdayTh = weekdayThMap[th.weekday % 7]; // luxon: 1=Monday → ต้อง mod ให้ 0=Sunday

    // ✅ คืนค่าในรูปแบบครบถ้วน
    return {
      status: "ok",
      isoThai: th.toISO(),                            // 1971-11-18T11:00:00.000+07:00
      dateThai: th.toFormat("yyyy-MM-dd"),            // 1971-11-18
      timeThai: th.toFormat("HH:mm:ss"),              // 11:00:00
      weekdayTh                                       // เสาร์, อาทิตย์, ฯลฯ
    };
  } catch (err) {
    console.error("❌ convertToThaiDate error:", err.message);
    return { status: "error", message: err.message };
  }
}
