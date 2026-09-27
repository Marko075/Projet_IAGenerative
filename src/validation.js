import { config } from "./config.js";
import { AppError } from "./errors.js";

const { longueurMessage, longueurMessageHistorique, messagesHistorique } = config.limites;

function erreurRequete(message) {
  return new AppError(400, "INVALID_REQUEST", message);
}

function validerTexte(valeur, nom, { obligatoire, longueurMax = longueurMessage }) {
  if (valeur === undefined || valeur === null || valeur === "") {
    if (obligatoire) throw erreurRequete(`Le champ "${nom}" est obligatoire.`);
    return "";
  }
  if (typeof valeur !== "string") throw erreurRequete(`Le champ "${nom}" doit être une chaîne.`);
  const texte = valeur.trim();
  if (obligatoire && !texte) throw erreurRequete(`Le champ "${nom}" ne peut pas être vide.`);
  if (texte.length > longueurMax) {
    throw erreurRequete(`Le champ "${nom}" dépasse ${longueurMax} caractères.`);
  }
  return texte;
}

// L'historique alterne user / assistant, commence par user et finit par assistant,
// pour que le nouveau message utilisateur puisse être ajouté à la suite.
function validerHistorique(historique) {
  if (historique === undefined || historique === null) return [];
  if (!Array.isArray(historique)) throw erreurRequete(`Le champ "history" doit être un tableau.`);

  const messages = historique.map((entree, i) => {
    const roleAttendu = i % 2 === 0 ? "user" : "assistant";
    if (!entree || entree.role !== roleAttendu) {
      throw erreurRequete(`history[${i}] : rôle "${roleAttendu}" attendu (alternance user / assistant).`);
    }
    const content = validerTexte(entree.content, `history[${i}].content`, {
      obligatoire: true,
      longueurMax: longueurMessageHistorique,
    });
    return { role: entree.role, content };
  });

  if (messages.length % 2 !== 0) {
    throw erreurRequete(`"history" doit se terminer par une réponse de l'assistant.`);
  }

  return bornerHistorique(messages);
}

// On ne garde que les derniers échanges pour borner la taille du contexte (et le coût).
// Le nombre gardé est pair pour que l'historique commence toujours par un message utilisateur.
export function bornerHistorique(messages) {
  const limitePaire = messagesHistorique - (messagesHistorique % 2);
  return limitePaire > 0 ? messages.slice(-limitePaire) : [];
}

export function validerRequeteChat(corps) {
  return {
    message: validerTexte(corps?.message, "message", { obligatoire: true }),
    historique: validerHistorique(corps?.history),
  };
}

function validerDocument(document) {
  if (typeof document !== "string" || !document) {
    throw erreurRequete(`Le champ "document" (fichier .pptx en base64) est obligatoire.`);
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(document)) {
    throw erreurRequete(`Le champ "document" n'est pas un base64 valide.`);
  }
  return document;
}

function validerNomDocument(nom) {
  const texte = validerTexte(nom, "documentName", { obligatoire: false, longueurMax: 200 });
  return texte || "présentation.pptx";
}

export function validerRequetePowerPoint(corps) {
  return {
    document: validerDocument(corps?.document),
    message: validerTexte(corps?.message, "message", { obligatoire: false }),
  };
}

// Message dans une conversation enregistrée : texte seul, ou PowerPoint + consigne facultative.
export function validerRequeteMessage(corps) {
  if (corps?.document !== undefined) {
    return {
      document: validerDocument(corps.document),
      nomDocument: validerNomDocument(corps.documentName),
      message: validerTexte(corps?.message, "message", { obligatoire: false }),
    };
  }
  return { message: validerTexte(corps?.message, "message", { obligatoire: true }) };
}

export function validerIdentifiants(corps) {
  const email = validerTexte(corps?.email, "email", { obligatoire: true, longueurMax: 254 });
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw erreurRequete("Adresse email invalide.");
  if (typeof corps?.password !== "string" || !corps.password) {
    throw erreurRequete(`Le champ "password" est obligatoire.`);
  }
  if (corps.password.length > 200) throw erreurRequete("Mot de passe trop long.");
  return { email, motDePasse: corps.password };
}

export function validerTitre(corps) {
  return validerTexte(corps?.title, "title", { obligatoire: true, longueurMax: 120 });
}
