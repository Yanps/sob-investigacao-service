import { Request, Response } from "express";
import { handleWhatsappWebhook } from "../services/webhook.service.js";

export async function whatsappWebhook(req: Request, res: Response) {
  try {
    const result = await handleWhatsappWebhook(req.body);
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
}
