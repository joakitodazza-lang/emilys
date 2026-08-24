// Prueba mínima de función serverless en Vercel.
module.exports = (req, res) => {
  res.status(200).json({ ok: true, msg: "pong" });
};
