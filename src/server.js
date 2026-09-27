// Point d'entrée du backend Transformers (Express).
// Chemin d'une requête : route (routes/) → contrôleur (controllers/) → service (services/)
// → modèle Bedrock et/ou stockage JSON (store/). Les erreurs remontent jusqu'au middleware d'erreur ci-dessous.

import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { AppError } from "./errors.js";
import authRoute from "./routes/AuthRoute.js";
import chatRoute from "./routes/ChatRoute.js";
import { amorcerAdmin } from "./services/AuthService.js";
import conversationRoute from "./routes/ConversationRoute.js";

// ---------- Application et routes ----------
// CORS ouvert : le frontend est servi depuis S3, une autre origine que ce serveur.
// La limite de taille du corps JSON permet d'envoyer des documents encodés en base64.
const app = express();
app.use(cors());
app.use(express.json({ limit: config.limites.tailleCorpsRequete }));
app.use("/api", authRoute);
app.use("/api", conversationRoute);
app.use("/api", chatRoute);

// Toute route non déclarée ci-dessus répond 404 au format JSON habituel.
app.use((req, res) => {
  res.status(404).json({ error: "Route inconnue.", code: "NOT_FOUND" });
});

// Middleware d'erreur : toutes les erreurs finissent ici avec un format de réponse unique
// { error: message lisible, code: identifiant stable } que le frontend affiche tel quel.
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

// ---------- Démarrage ----------
// Crée le compte admin décrit dans src/seed/admin.json s'il n'existe pas encore, puis écoute.
const admin = await amorcerAdmin();
if (admin) console.log(`👤 Compte admin créé : ${admin.email}`);

app.listen(config.port, () => console.log(`✅ Serveur lancé sur http://localhost:${config.port} (modèle : ${config.modele.id})`));
