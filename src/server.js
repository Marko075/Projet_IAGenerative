import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chatRoute from "./routes/ChatRoute.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api", chatRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur lancé sur http://localhost:${PORT}`));