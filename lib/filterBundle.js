// ----------------------------------------------------------------------
// filterBundle.js — Human Response Finalizer (AstroWise Hybrid Edition)
// ----------------------------------------------------------------------
// 🪶 Purpose:
// รวมทุกชั้นของฟิลเตอร์ (Emotion + Politeness + Signature + Rephrase)
// เพื่อให้ข้อความของหมอฟังเหมือนมนุษย์จริง: อบอุ่น สุภาพ ไม่ซ้ำ ไม่เลี่ยน
// ----------------------------------------------------------------------

// 🌿 Config
const EMOTION_EMOJI = ["🌙", "🌿", "💧", "☀️", "💫"];
const EMOTION_PHRASES = [
  "หมออยู่ตรงนี้เสมอครับ",
  "หมออยู่ตรงนี้เสมอนะครับ",
  "หมอจะเล่าให้อ่อนโยน",
  "หมอเข้าใจคุณมากนะครับ",
  "หมอเข้าใจคุณจริง ๆ",
  "หมอพูดด้วยความอ่อนโยน",
];
const POLITE_WORDS = ["ครับ", "นะครับ", "ค่ะ", "นะคะ"];
const FAREWELL_WORDS = [
  "ขอบคุณ",
  "พอแค่นี้",
  "ลา",
  "เจอกันใหม่",
  "ไว้คุยกันอีก",
  "ขอจบ",
];

// 🌕 Memory flag (เก็บสถานะ emoji ล่าสุด)
let lastEmotionEmoji = null;
let lastEmotionTurn = -1;

// ----------------------------------------------------------------------
// 1️⃣ Emotion Filter (กัน emoji และวลีปลอบใจซ้ำ)
// ----------------------------------------------------------------------
function emotionFilter(text, currentTurn = 1) {
  // ลบวลีปลอบใจซ้ำ
  for (const phrase of EMOTION_PHRASES) {
    if (text.includes(phrase)) {
      text = text.replaceAll(phrase, "");
    }
  }

  // ตรวจ emoji ซ้ำใน 2 turn ล่าสุด
  const foundEmoji = EMOTION_EMOJI.find((e) => text.includes(e));
  if (foundEmoji) {
    if (
      foundEmoji === lastEmotionEmoji &&
      currentTurn - lastEmotionTurn < 2
    ) {
      text = text.replaceAll(foundEmoji, "");
    } else {
      lastEmotionEmoji = foundEmoji;
      lastEmotionTurn = currentTurn;
    }
  }

  // จำกัด emoji ไม่เกิน 2 ตัว
  let emojiCount = EMOTION_EMOJI.reduce(
    (acc, e) => acc + (text.split(e).length - 1),
    0
  );
  if (emojiCount > 2) {
    for (const e of EMOTION_EMOJI) {
      while (text.split(e).length - 1 > 2) {
        text = text.replace(e, "");
      }
    }
  }

  return text.trim();
}

// ----------------------------------------------------------------------
// 2️⃣ Dynamic Politeness Adjuster
// ----------------------------------------------------------------------
function adjustPoliteness(text, userText) {
  const isPoliteUser = /ครับ|ค่ะ|ขอ|ครับผม|ค่ะพี่|รบกวน/.test(userText);
  if (!isPoliteUser) {
    // ถ้าผู้ใช้พูดกันเอง → ลดระดับสุภาพลง
    text = text.replace(/(ครับ|นะครับ|ค่ะ|นะคะ)/g, "");
    if (!/[.!?]$/.test(text)) text += " นะ";
  }
  return text.trim();
}

// ----------------------------------------------------------------------
// 3️⃣ Smart Signature Controller
// ----------------------------------------------------------------------
function signatureFilter(text, userText) {
  const isFarewell = FAREWELL_WORDS.some((w) => userText.includes(w));
  if (isFarewell) {
    if (!text.includes("หมออยู่ตรงนี้เสมอ"))
      text = text.trim() + " หมออยู่ตรงนี้เสมอครับ 🌙";
  } else {
    text = text.replace(/หมออยู่ตรงนี้เสมอ(ครับ|นะครับ)/g, "");
  }
  return text.trim();
}

// ----------------------------------------------------------------------
// 4️⃣ Smart Rephrase Controller
// ----------------------------------------------------------------------
function smartRephrase(text) {
  // ลบคำสุภาพซ้ำ
  text = text.replace(/(ครับ|ค่ะ){2,}/g, "$1");
  text = text.replace(/(นะครับ|นะคะ){2,}/g, "$1");
  // ลบ emoji ซ้ำติดกัน
  text = text.replace(/([🌙🌿💧☀️💫])\1+/g, "$1");
  // ลบช่องว่างซ้ำ
  text = text.replace(/\s{2,}/g, " ");
  return text.trim();
}

// ----------------------------------------------------------------------
// 🌙 Main Function
// ----------------------------------------------------------------------
export function applyAllFilters(text, userText, currentTurn = 1) {
  let t = text;
  t = emotionFilter(t, currentTurn);
  t = adjustPoliteness(t, userText);
  t = signatureFilter(t, userText);
  t = smartRephrase(t);
  return t.trim();
}

// ----------------------------------------------------------------------
// 🌤️ Example Test (node lib/filterBundle.js)
// ----------------------------------------------------------------------
if (process.argv[1].includes("filterBundle.js")) {
  const samples = [
    ["วันนี้เหนื่อยมากเลยหมอ 😩", "หมอเห็นจังหวะดีของคุณครับ 🌙", 1],
    ["แล้วจะดีขึ้นมั้ยครับ", "หมอว่าอีกไม่นานคุณจะเบาขึ้นนะครับ 🌙", 2],
    ["โอเค ขอบคุณครับ", "หมอขอให้วันนี้ใจคุณสงบขึ้นนะครับ 🌿", 3],
  ];
  for (const [u, r, turn] of samples) {
    console.log(`U${turn}: ${u}`);
    console.log("M:", applyAllFilters(r, u, turn));
    console.log("-".repeat(40));
  }
}
