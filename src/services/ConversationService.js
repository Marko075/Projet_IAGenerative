import crypto from "node:crypto";
import { AppError } from "../errors.js";
import { db, sauvegarder } from "../store/JsonStore.js";
import { bornerHistorique } from "../validation.js";
import { askBedrock, resumerDocument } from "./BedrockService.js";

const LONGUEUR_TITRE_AUTO = 60;

// Conversations pour lesquelles une réponse est en cours de génération :
// empêche deux envois simultanés de casser l'alternance user / assistant.
const enCours = new Set();

const maintenant = () => new Date().toISOString();

function resume(conversation) {
  const { id, title, createdAt, updatedAt } = conversation;
  return { id, title, createdAt, updatedAt };
}

// Une conversation d'un autre utilisateur est traitée comme inexistante (404, pas 403).
function trouver(userId, id) {
  const conversation = db.conversations.find((c) => c.id === id && c.userId === userId);
  if (!conversation) throw new AppError(404, "NOT_FOUND", "Conversation introuvable.");
  return conversation;
}

function titreAutomatique(texte) {
  const ligne = texte.replace(/\s+/g, " ").trim();
  return ligne.length > LONGUEUR_TITRE_AUTO ? `${ligne.slice(0, LONGUEUR_TITRE_AUTO - 1)}…` : ligne;
}

function nouveauMessage(role, content, extra = {}) {
  return { id: crypto.randomUUID(), role, content, createdAt: maintenant(), ...extra };
}

function historiquePourModele(messages) {
  return bornerHistorique(messages.map(({ role, content }) => ({ role, content })));
}

async function avecVerrou(conversationId, action) {
  if (enCours.has(conversationId)) {
    throw new AppError(409, "BUSY", "Une réponse est déjà en cours dans cette conversation.");
  }
  enCours.add(conversationId);
  try {
    return await action();
  } finally {
    enCours.delete(conversationId);
  }
}

// ---------- CRUD ----------
// Les conversations encore vides (premier message en cours ou jamais abouti) ne sont pas listées.
export function lister(userId) {
  return db.conversations
    .filter((c) => c.userId === userId && c.messages.length > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(resume);
}

export async function creer(userId) {
  const date = maintenant();
  const conversation = { id: crypto.randomUUID(), userId, title: "Nouvelle conversation", createdAt: date, updatedAt: date, messages: [] };
  db.conversations.push(conversation);
  await sauvegarder();
  return { ...resume(conversation), messages: [] };
}

export function obtenir(userId, id) {
  const conversation = trouver(userId, id);
  return { ...resume(conversation), messages: conversation.messages };
}

export async function renommer(userId, id, titre) {
  const conversation = trouver(userId, id);
  conversation.title = titre;
  await sauvegarder();
  return resume(conversation);
}

export async function supprimer(userId, id) {
  trouver(userId, id);
  db.conversations = db.conversations.filter((c) => c.id !== id);
  await sauvegarder();
}

// ---------- Échanges avec le modèle ----------
// Rien n'est enregistré si l'appel au modèle échoue (ou si le client annule) :
// la conversation reste une alternance propre user / assistant.
export async function envoyerMessage(userId, id, { message, document, nomDocument, typeDocument }, { signal } = {}) {
  const conversation = trouver(userId, id);

  return avecVerrou(id, async () => {
    const historique = historiquePourModele(conversation.messages);
    const resultat = document
      ? await resumerDocument(document, { nom: nomDocument, type: typeDocument }, message, { historique, signal })
      : await askBedrock(historique, message, { signal });

    const contenuUtilisateur = document
      ? `[Fichier joint : ${nomDocument}]${message ? ` ${message}` : ""}`
      : message;
    const messageUtilisateur = nouveauMessage("user", contenuUtilisateur, document ? { attachment: nomDocument } : {});
    const messageAssistant = nouveauMessage("assistant", resultat.texte, { truncated: resultat.tronquee });

    if (conversation.messages.length === 0) {
      conversation.title = document ? `Résumé : ${nomDocument}` : titreAutomatique(message);
    }
    conversation.messages.push(messageUtilisateur, messageAssistant);
    conversation.updatedAt = maintenant();
    await sauvegarder();

    return { conversation: resume(conversation), messages: [messageUtilisateur, messageAssistant], usage: resultat.usage };
  });
}

// Redemande une réponse au dernier message utilisateur. L'ancienne réponse
// n'est remplacée qu'une fois la nouvelle obtenue.
export async function regenerer(userId, id, { signal } = {}) {
  const conversation = trouver(userId, id);
  const dernier = conversation.messages.at(-1);
  if (dernier?.role !== "assistant") {
    throw new AppError(400, "NOTHING_TO_REGENERATE", "Aucune réponse à régénérer.");
  }

  return avecVerrou(id, async () => {
    const precedents = conversation.messages.slice(0, -2);
    const questionUtilisateur = conversation.messages.at(-2);
    const resultat = await askBedrock(historiquePourModele(precedents), questionUtilisateur.content, { signal });

    const messageAssistant = nouveauMessage("assistant", resultat.texte, { truncated: resultat.tronquee });
    conversation.messages.splice(-1, 1, messageAssistant);
    conversation.updatedAt = maintenant();
    await sauvegarder();

    return { conversation: resume(conversation), message: messageAssistant, usage: resultat.usage };
  });
}
