// Routes du mode invité : accessibles sans compte, rien n'est enregistré côté serveur.
// L'historique de la conversation est renvoyé par le navigateur à chaque message.
import express from "express";
import { handleChat, handleSummarizeDocument } from "../controllers/ChatController.js";

const router = express.Router();
router.post("/chat", handleChat);                            // question + historique → réponse du modèle
router.post("/document/summarize", handleSummarizeDocument); // document joint + consigne → réponse du modèle

export default router;
