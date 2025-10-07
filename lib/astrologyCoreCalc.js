// lib/astrologyCoreCalc.js
import swisseph from "swisseph";
import { DateTime } from "luxon";

/**
 * แปลงเวลาเกิดจากโซนท้องถิ่น -> UTC
 */
function toUTC(date, time, zone) {
  const dt = DateTime.fromISO(`${date}T${time}`, { zone });
  if (!dt.isValid) throw new Error("❌ รูปแบบวันเวลาไม่ถูกต้อง");
  return dt.toUTC();
}

/**
 * แปลงวันที่ UTC เป็น Julian Day (ใช้โดย Swiss Ephemeris)
 */
function toJulianDay(dtUTC) {
  return swisseph.swe_julday(
    dtUTC.year,
    dtUTC.month,
    dtUTC.day,
    dtUTC.hour + dtUTC.minute / 60 + dtUTC.second / 3600,
    swisseph.SE_GREG_CAL
  );
}

/**
 * ดึงตำแหน่งดาวเคราะห์หลัก
 */
async function getPlanetPositions(jd) {
  const planetList = {
    SUN: swisseph.SE_SUN,
    MOON: swisseph.SE_MOON,
    MERCURY: swisseph.SE_MERCURY,
    VENUS: swisseph.SE_VENUS,
    MARS: swisseph.SE_MARS,
    JUPITER: swisseph.SE_JUPITER,
    SATURN: swisseph.SE_SATURN,
    RAHU: swisseph.SE_MEAN_NODE,
    KETU: swisseph.SE_TRUE_NODE,
  };

  const result = {};
  for (const [name, id] of Object.entries(planetList)) {
    const data = await new Promise((resolve, reject) => {
      swisseph.swe_calc_ut(jd, id, swisseph.SEFLG_SWIEPH, (body) => {
        if (body.error) reject(body.error);
        else resolve(body.longitude);
      });
    });
    result[name] = Number(data.toFixed(4));
  }
  return result;
}

/**
 * คำนวณลัคนา (Ascendant)
 */
async function getAscendant(jd, lat, lng) {
  return await new Promise((resolve, reject) => {
    swisseph.swe_houses(jd, lat, lng, "P", (houses) => {
      if (houses.error) reject(houses.error);
      else resolve(Number(houses.ascendant.toFixed(4)));
    });
  });
}

/**
 * ฟังก์ชันหลัก: คำนวณดวงดาวจริง
 * @param {Object} birth - { date, time, lat, lng, zone }
 */
export async function calcAstroChart(birth) {
  try {
    const dtUTC = toUTC(birth.date, birth.time, birth.zone);
    const jd = toJulianDay(dtUTC);

    const planets = await getPlanetPositions(jd);
    const ascendant = await getAscendant(jd, birth.lat, birth.lng);

    return {
      status: "ok",
      utc: dtUTC.toISO(),
      julianDay: jd,
      planets,
      ascendant,
    };
  } catch (err) {
    console.error("❌ calcAstroChart failed:", err.message);
    return { status: "error", message: err.message };
  }
}
