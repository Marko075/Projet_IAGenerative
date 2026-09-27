import express from "express";
import { handleChat, handleSummarizeDocument } from "../controllers/ChatController.js";

const router = express.Router();
router.post("/chat", handleChat);
router.post("/document/summarize", handleSummarizeDocument);

export default router;
