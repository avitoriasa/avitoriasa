import { Router } from "express";
import {
  addTrustedSupplier,
  listTrustedSuppliers,
  removeTrustedSupplier,
} from "../services/trustedSupplierService.js";

export const trustedSuppliersRouter = Router();

trustedSuppliersRouter.get("/", async (_req, res) => {
  res.json(await listTrustedSuppliers());
});

trustedSuppliersRouter.post("/", async (req, res) => {
  const { name, category, channel, country, trustNotes, sourceLeadId } = req.body ?? {};
  if (!name || !category || !channel || !country) {
    return res.status(400).json({ error: "Campos obrigatórios: name, category, channel, country" });
  }
  const supplier = await addTrustedSupplier({
    name,
    category,
    channel,
    country,
    trustNotes: trustNotes ?? "",
    sourceLeadId,
  });
  res.status(201).json(supplier);
});

trustedSuppliersRouter.delete("/:id", async (req, res) => {
  await removeTrustedSupplier(req.params.id);
  res.status(204).end();
});
