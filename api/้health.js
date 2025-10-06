// api/health.js
export default async function handler(req, res) {
  return res.status(200).json({
    status: "ok",
    service: "Astrowise-API",
    version: "2.6.0",
    timestamp: new Date().toISOString(),
  });
}
