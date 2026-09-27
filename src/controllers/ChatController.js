import { askBedrock, resumerPowerPoint } from "../services/BedrockService.js";

export async function handleChat(req, res) {
  try {
    const { message, image, document, documentType } = req.body;

    let reponse;

    if (documentType === "pptx" && document) {
      reponse = await resumerPowerPoint(document, message);
    } else {
      reponse = await askBedrock(message, image || null);
    }

    res.json({ response: reponse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}