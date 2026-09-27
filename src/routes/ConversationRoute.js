// Routes des conversations enregistrées (utilisateur connecté uniquement).
import express from "express";
import {
  handleCreate,
  handleDelete,
  handleGet,
  handleList,
  handleRegenerate,
  handleRename,
  handleSendMessage,
} from "../controllers/ConversationController.js";
import { requireAuth } from "../middleware/auth.js";

// Toutes les routes de conversations exigent d'être connecté ;
// chaque utilisateur ne voit que ses propres conversations.
const router = express.Router();
router.use("/conversations", requireAuth);

// Gestion de la liste : lister, créer, lire (avec messages), renommer, supprimer.
router.get("/conversations", handleList);
router.post("/conversations", handleCreate);
router.get("/conversations/:id", handleGet);
router.patch("/conversations/:id", handleRename);
router.delete("/conversations/:id", handleDelete);

// Échanges avec le modèle : nouveau message (texte ou document) et régénération de la dernière réponse.
router.post("/conversations/:id/messages", handleSendMessage);
router.post("/conversations/:id/regenerate", handleRegenerate);

export default router;
