import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { AppError } from "./errors.js";
import authRoute from "./routes/AuthRoute.js";
import chatRoute from "./routes/ChatRoute.js";
import { amorcerAdmin } from "./services/AuthService.js";
import conversationRoute from "./routes/ConversationRoute.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: config.limites.tailleCorpsRequete }));
app.use("/api", authRoute);
app.use("/api", conversationRoute);
app.use("/api", chatRoute);

app.use((req, res) => {
  res.status(404).json({ error: "Route inconnue.", code: "NOT_FOUND" });
});

// Middleware d'erreur : toutes les erreurs finissent ici avec un format de réponse unique.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Fichier ou message trop volumineux.", code: "PAYLOAD_TOO_LARGE" });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Corps de requête JSON invalide.", code: "INVALID_JSON" });
  }
  console.error(err);
  res.status(500).json({ error: "Erreur serveur.", code: "INTERNAL_ERROR" });
});

const admin = await amorcerAdmin();
if (admin) console.log(`👤 Compte admin créé : ${admin.email}`);

app.listen(config.port, () => console.log(`✅ Serveur lancé sur http://localhost:${config.port} (modèle : ${config.modele.id})`));
