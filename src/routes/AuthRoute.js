// Routes d'authentification et d'information.
// /info et /auth/login sont publiques ; /auth/logout et /auth/me exigent un jeton valide.
import express from "express";
import { handleInfo, handleLogin, handleLogout, handleMe } from "../controllers/AuthController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.get("/info", handleInfo);
router.post("/auth/login", handleLogin);
router.post("/auth/logout", requireAuth, handleLogout);
router.get("/auth/me", requireAuth, handleMe);

export default router;
