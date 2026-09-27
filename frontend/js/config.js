// Configuration du frontend.

// Adresse de l'API. En local (frontend servi sur localhost), on vise le backend local ; sinon le serveur EC2.
// window.TRANSFORMERS_API_URL permet de la surcharger sans modifier ce fichier.
const enLocal = ["localhost", "127.0.0.1"].includes(location.hostname);

export const API_URL = window.TRANSFORMERS_API_URL
  || (enLocal ? "http://localhost:3000/api" : "http://3.120.6.19:3000/api");

export const NOM_ASSISTANT = "Transformers";
export const TAILLE_MAX_DOCUMENT = 10 * 1024 * 1024; // 10 Mo (le serveur accepte 15 Mo en base64)

// Formats de pièces jointes acceptés (doit correspondre à config.formatsDocument côté serveur).
export const FORMATS_DOCUMENT = { pdf: "PDF", docx: "Word", xlsx: "Excel", pptx: "PowerPoint" };
