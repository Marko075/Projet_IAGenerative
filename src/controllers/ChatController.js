import { askBedrock } from "../services/BedrockService.js";

export async function handleChat(req, res) {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Le champ 'message' est requis" });
    }

    const reponse = await askBedrock(message);
    res.json({ response: reponse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}