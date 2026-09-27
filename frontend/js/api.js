import { API_URL } from "./config.js";

// ---------- Stockage local (protégé : localStorage peut être indisponible) ----------
export const stockage = {
  lire(cle) {
    try { return localStorage.getItem(cle); } catch { return null; }
  },
  ecrire(cle, valeur) {
    try {
      if (valeur === null || valeur === undefined) localStorage.removeItem(cle);
      else localStorage.setItem(cle, valeur);
    } catch {}
  },
};

const CLE_JETON = "transformers.token";
export const jeton = {
  get: () => stockage.lire(CLE_JETON),
  set: (valeur) => stockage.ecrire(CLE_JETON, valeur),
};

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let surSessionExpiree = () => {};
export function quandSessionExpiree(callback) {
  surSessionExpiree = callback;
}

async function requete(chemin, { method = "GET", body, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = jeton.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(API_URL + chemin, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK", "Impossible de contacter le serveur. Vérifiez votre connexion.");
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && token && chemin !== "/auth/login") surSessionExpiree();
    throw new ApiError(res.status, data?.code ?? "ERROR", data?.error ?? "Réponse invalide du serveur.");
  }
  return data;
}

const enc = encodeURIComponent;

export const api = {
  info: () => requete("/info"),

  connexion: (email, password) => requete("/auth/login", { method: "POST", body: { email, password } }),
  deconnexion: () => requete("/auth/logout", { method: "POST" }),
  moi: () => requete("/auth/me"),

  listerConversations: () => requete("/conversations"),
  creerConversation: () => requete("/conversations", { method: "POST" }),
  obtenirConversation: (id) => requete(`/conversations/${enc(id)}`),
  renommerConversation: (id, title) => requete(`/conversations/${enc(id)}`, { method: "PATCH", body: { title } }),
  supprimerConversation: (id) => requete(`/conversations/${enc(id)}`, { method: "DELETE" }),
  envoyerMessage: (id, corps, signal) => requete(`/conversations/${enc(id)}/messages`, { method: "POST", body: corps, signal }),
  regenerer: (id, signal) => requete(`/conversations/${enc(id)}/regenerate`, { method: "POST", signal }),

  // Mode invité : rien n'est enregistré côté serveur, l'historique est envoyé à chaque fois.
  chatInvite: (message, history, signal) => requete("/chat", { method: "POST", body: { message, history }, signal }),
  documentInvite: (document, documentName, message, signal) =>
    requete("/document/summarize", { method: "POST", body: { document, documentName, message }, signal }),
};
