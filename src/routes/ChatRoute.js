import express from "express";
import { handleChat, handleSummarizePptx } from "../controllers/ChatController.js";

const router = express.Router();
router.post("/chat", handleChat);
router.post("/pptx/summarize", handleSummarizePptx);

export default router;
