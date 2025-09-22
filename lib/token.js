// lib/token.js
export function generateUserId() {
  // เลขสุ่ม 5 หลัก
  return Math.floor(10000 + Math.random() * 90000).toString();
}

export function generateToken() {
  // เลขสุ่ม 5 หลัก
  return Math.floor(10000 + Math.random() * 90000).toString();
}

