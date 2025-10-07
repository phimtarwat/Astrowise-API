// lib/utils/weekdayStrict.js
// ฟังก์ชันคำนวณวันในสัปดาห์แบบ deterministic
// ไม่พึ่ง Date(), timezone หรือ external API

const WEEK_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const WEEK_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TH_MONTH = {
  "มกราคม": 1, "ม.ค.": 1, "กุมภาพันธ์": 2, "ก.พ.": 2, "มีนาคม": 3, "มี.ค.": 3,
  "เมษายน": 4, "เม.ย.": 4, "พฤษภาคม": 5, "พ.ค.": 5, "มิถุนายน": 6, "มิ.ย.": 6,
  "กรกฎาคม": 7, "ก.ค.": 7, "สิงหาคม": 8, "ส.ค.": 8, "กันยายน": 9, "ก.ย.": 9,
  "ตุลาคม": 10, "ต.ค.": 10, "พฤศจิกายน": 11, "พ.ย.": 11, "ธันวาคม": 12, "ธ.ค.": 12
};

function normalizeYear(y) {
  const yr = parseInt(y, 10);
  if (yr > 2400) return yr - 543;        // พ.ศ. → ค.ศ.
  if (yr < 100) return (2500 + yr) - 543; // ปี 2 หลัก เช่น 68 → 2025
  return yr;
}

function normalizeMonth(m) {
  const str = String(m).trim().toLowerCase();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  return TH_MONTH[str] || (() => { throw new Error("เดือนผิดรูปแบบ"); })();
}

// สูตร Sakamoto Algorithm
function weekdayIndex(y, m, d) {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  if (m < 3) y -= 1;
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m - 1] + d) % 7;
}

export function getWeekdayStrict(input) {
  const s = input.trim().replace(/,/g, " ").replace(/\s+/g, " ");
  let d, m, y;

  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  const m2 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  const m3 = s.match(/^(\d{1,2})\s+([^\s]+)\s+(\d{2,4})$/);

  if (m1) {
    d = parseInt(m1[1], 10); m = parseInt(m1[2], 10); y = normalizeYear(m1[3]);
  } else if (m2) {
    y = normalizeYear(m2[1]); m = parseInt(m2[2], 10); d = parseInt(m2[3], 10);
  } else if (m3) {
    d = parseInt(m3[1], 10); m = normalizeMonth(m3[2]); y = normalizeYear(m3[3]);
  } else {
    throw new Error("รูปแบบวันที่ไม่รองรับ");
  }

  const idx = weekdayIndex(y, m, d);
  const iso = `${y.toString().padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return {
    status: "ok",
    date: iso,
    weekdayTh: WEEK_TH[idx],
    weekdayEn: WEEK_EN[idx],
  };
}

