import { askBedrock, resumerDocument } from "../services/BedrockService.js";
import { signalDeconnexion } from "../utils/signalDeconnexion.js";
import { validerRequeteChat, validerRequeteDocument } from "../validation.js";

// Routes du mode invité : rien n'est enregistré, l'historique est fourni par le client.
// Express 5 transmet automatiquement les erreurs des handlers async au middleware d'erreur (server.js).

function envoyerReponse(res, { texte, tronquee, usage }) {
  res.json({ response: texte, truncated: tronquee, usage });
}

export async function handleChat(req, res) {
  const { message, historique } = validerRequeteChat(req.body);
  envoyerReponse(res, await askBedrock(historique, message, { signal: signalDeconnexion(res) }));
}

export async function handleSummarizeDocument(req, res) {
  const { document, nomDocument, typeDocument, message } = validerRequeteDocument(req.body);
  const resultat = await resumerDocument(document, { nom: nomDocument, type: typeDocument }, message, {
    signal: signalDeconnexion(res),
  });
  envoyerReponse(res, resultat);
}
