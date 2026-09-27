// Contrôleurs des conversations enregistrées (utilisateur connecté).
// req.user est rempli par le middleware requireAuth ; chaque appel au service passe son id,
// ce qui garantit qu'un utilisateur n'agit que sur ses propres conversations.
import * as conversations from "../services/ConversationService.js";
import { signalDeconnexion } from "../utils/signalDeconnexion.js";
import { validerRequeteMessage, validerTitre } from "../validation.js";

// ---------- Gestion des conversations (liste, création, lecture, renommage, suppression) ----------
export function handleList(req, res) {
  res.json({ conversations: conversations.lister(req.user.id) });
}

export async function handleCreate(req, res) {
  res.status(201).json({ conversation: await conversations.creer(req.user.id) });
}

export function handleGet(req, res) {
  res.json({ conversation: conversations.obtenir(req.user.id, req.params.id) });
}

export async function handleRename(req, res) {
  const titre = validerTitre(req.body);
  res.json({ conversation: await conversations.renommer(req.user.id, req.params.id, titre) });
}

export async function handleDelete(req, res) {
  await conversations.supprimer(req.user.id, req.params.id);
  res.status(204).end();
}

// ---------- Échanges avec le modèle ----------
// Le signal annule l'appel au modèle si le client ferme la connexion (bouton « Stop »).
export async function handleSendMessage(req, res) {
  const requete = validerRequeteMessage(req.body);
  const signal = signalDeconnexion(res);
  res.json(await conversations.envoyerMessage(req.user.id, req.params.id, requete, { signal }));
}

export async function handleRegenerate(req, res) {
  const signal = signalDeconnexion(res);
  res.json(await conversations.regenerer(req.user.id, req.params.id, { signal }));
}
