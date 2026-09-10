import { Router } from "express";
import { db } from "../db.js";

export const marketplacesRouter = Router();

marketplacesRouter.get("/", async (_req, res) => {
  const store = await db.read();
  res.json(store.marketplaces);
});
