import { Router } from "express";
import { db } from "../firebase/firestore.js";
import { PubSub } from "@google-cloud/pubsub";

const router = Router();
const pubsub = new PubSub();
const topicName = "sob-processing-jobs";

router.get("/health", async (req, res) => {
  const result: { ok: boolean; firestore: string; pubsub: string } = {
    ok: true,
    firestore: "ok",
    pubsub: "ok",
  };

  try {
    await db.collection("_health").limit(1).get();
  } catch (err) {
    result.firestore = "error";
    result.ok = false;
  }

  try {
    await pubsub.topic(topicName).get();
  } catch (err) {
    result.pubsub = "error";
    result.ok = false;
  }

  const status = result.ok ? 200 : 503;
  res.status(status).json(result);
});

export default router;