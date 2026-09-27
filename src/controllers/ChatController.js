// Contrôleurs du mode invité : valident la requête, appellent le service Bedrock, renvoient la réponse.
// Rien n'est enregistré, l'historique est fourni par le client.
// Express 5 transmet automatiquement les erreurs des handlers async au middleware d'erreur (server.js).
import { askBedrock, resumerDocument } from "../services/BedrockService.js";
import { signalDeconnexion } from "../utils/signalDeconnexion.js";
import { validerRequeteChat, validerRequeteDocument } from "../validation.js";

// Format de réponse commun aux deux routes : texte, indicateur de réponse coupée, tokens consommés.
function envoyerReponse(res, { texte, tronquee, usage }) {
  res.json({ response: texte, truncated: tronquee, usage });
}

// POST /api/chat — le signal annule l'appel au modèle si l'utilisateur clique sur « Stop ».
export async function handleChat(req, res) {
  const { message, historique } = validerRequeteChat(req.body);
  envoyerReponse(res, await askBedrock(historique, message, { signal: signalDeconnexion(res) }));
}

// POST /api/document/summarize — le texte du document est extrait puis envoyé au modèle avec la consigne.
export async function handleSummarizeDocument(req, res) {
  const { document, nomDocument, typeDocument, message } = validerRequeteDocument(req.body);
  const resultat = await resumerDocument(document, { nom: nomDocument, type: typeDocument }, message, {
    signal: signalDeconnexion(res),
  });
  envoyerReponse(res, resultat);
}
