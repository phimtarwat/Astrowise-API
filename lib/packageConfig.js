// lib/packageConfig.js
// กำหนด mapping ของราคา (หน่วยสตางค์) -> package + quota
// เช่น 4900 = 49.00 THB
export const PACKAGE_CONFIG = {
  5900: { name: "lite", quota: 5 },
  9900: { name: "standard", quota: 10 },
  19900: { name: "premium", quota: 30 },
};

// ฟังก์ชัน helper
export function getPackageByAmount(amount) {
  const pkg = PACKAGE_CONFIG[amount];
  if (pkg) return pkg;
  return { name: "unknown", quota: 0 };
}

