// lib/googleSheet.js
import { google } from "googleapis";

async function getSheet() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// 🔎 ค้นหา user จาก Members sheet
export async function findUser(userId, token) {
  const sheets = await getSheet();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: "Members!A2:G", // ✅ ใช้ Members แทน Users
  });

  const rows = res.data.values || [];
  const user = rows.find(r => r[0] === userId && r[1] === token);
  if (!user) return null;

  return {
    user_id: user[0],
    token: user[1],
    email: user[2],
    quota: parseInt(user[3], 10),
    created_at: user[4],
    paid_at_
