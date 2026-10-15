export default async function handler(req, res) {
  res.status(404).json({ success: false, error: { message: "Endpoint not found", details: [] } });
}
