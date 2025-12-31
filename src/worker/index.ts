import express from "express";
import { handleJobEvent } from "./handler.js";

const app = express();

// 🔥 PARSER EXPLÍCITO
app.use(express.json({ type: "*/*" }));

app.post("/", async (req, res) => {
  console.log("🔥 WORKER HIT 🔥");
  console.log("Headers:", req.headers);
  console.log("Body:", JSON.stringify(req.body));

  try {
    if (!req.body || !req.body.message || !req.body.message.data) {
      console.error("❌ Payload inválido recebido");
      return res.status(204).send(); // ACK para não travar retry
    }

    await handleJobEvent(req.body.message);

    return res.status(204).send(); // ACK explícito
  } catch (err) {
    console.error("🔥 WORKER ERROR:", err);
    return res.status(500).send(); // força retry
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("🚀 Worker listening on port", PORT);
});
