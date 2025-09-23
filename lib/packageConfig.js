// lib/packageConfig.js
// กำหนด mapping ของราคา (amount_received หน่วยสตางค์) -> package + quota
export const PACKAGE_CONFIG = {
  5900: { name: "lite", quota: 5 },      // 59.00 THB
  9900: { name: "standard", quota: 10 }, // 99.00 THB
  19900: { name: "premium", quota: 30 }, // 199.00 THB
};

// ฟังก์ชัน helper + fallback
export function getPackageByAmount(amount) {
  const pkg = PACKAGE_CONFIG[amount];
  if (pkg) {
    return pkg;
  }

  console.warn("⚠️ Unknown amount:", amount, "→ fallback to lite (5)");
  return { name: "lite", quota: 5 }; // fallback
}
