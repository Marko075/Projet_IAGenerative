import "dotenv/config";

// Configuration centralisée du backend.
// Toute la configuration passe par des variables d'environnement (.env).
// Les valeurs par défaut permettent de lancer le projet sans rien ajouter au .env existant.
// Changer de modèle, de limites ou de prompt ne demande donc aucune modification du code.

// Lecture d'une variable numérique, avec valeur par défaut si absente ou invalide.
function entier(nom, defaut) {
  const valeur = Number.parseInt(process.env[nom], 10);
  return Number.isFinite(valeur) ? valeur : defaut;
}

function decimal(nom, defaut) {
  const valeur = Number.parseFloat(process.env[nom]);
  return Number.isFinite(valeur) ? valeur : defaut;
}

// Prompt système : consignes envoyées au modèle avant chaque conversation (rôle, ton, limites).
// Remplaçable par la variable SYSTEM_PROMPT.
const PROMPT_SYSTEME_PAR_DEFAUT = `Tu es Transformers, l'assistant conversationnel interne de l'entreprise.
Tu réponds en français, de façon claire, précise et structurée.
Si tu ne connais pas la réponse ou si une information te manque, dis-le plutôt que d'inventer.
Tu ne demandes jamais d'informations personnelles sensibles (mots de passe, données bancaires, santé).`;

// Libellés lisibles des régions AWS, affichés dans le bandeau de l'interface.
const REGIONS = {
  "eu-central-1": "Francfort, Allemagne",
  "eu-west-1": "Irlande",
  "eu-west-3": "Paris, France",
  "eu-north-1": "Stockholm, Suède",
  "eu-south-1": "Milan, Italie",
  "us-east-1": "Virginie, États-Unis",
  "us-west-2": "Oregon, États-Unis",
};

// Documents acceptés en pièce jointe (extension -> libellé), lus par officeparser.
const FORMATS_DOCUMENT = { pdf: "PDF", docx: "Word", xlsx: "Excel", pptx: "PowerPoint" };

// ---------- Configuration exportée ----------
// Regroupée par thème : identité de l'assistant, stockage, authentification,
// modèle, appels Bedrock et limites (taille des messages, de l'historique, des documents).
export const config = {
  port: entier("PORT", 3000),
  awsRegion: process.env.AWS_REGION,
  nomAssistant: "Transformers",
  fournisseur: "AWS Bedrock",
  libelleRegion: REGIONS[process.env.AWS_REGION] || process.env.AWS_REGION || "région inconnue",

  formatsDocument: FORMATS_DOCUMENT,

  stockage: {
    fichier: process.env.DATA_FILE || "data/db.json",
  },

  auth: {
    dureeSessionJours: entier("SESSION_TTL_DAYS", 7),
    tentativesConnexionParMinute: entier("LOGIN_ATTEMPTS_PER_MINUTE", 5),
  },

  modele: {
    id: process.env.MODEL_ID || "zai.glm-4.7-flash",
    libelle: process.env.MODEL_LABEL || "GLM-4.7 Flash",
    maxTokens: entier("MAX_TOKENS", 2048),
    temperature: decimal("TEMPERATURE", 0.5),
    promptSysteme: process.env.SYSTEM_PROMPT || PROMPT_SYSTEME_PAR_DEFAUT,
  },

  bedrock: {
    timeoutMs: entier("BEDROCK_TIMEOUT_MS", 60000),
    tentativesMax: entier("BEDROCK_MAX_ATTEMPTS", 2), // 1 appel + 1 retry
  },

  limites: {
    tailleCorpsRequete: process.env.MAX_BODY_SIZE || "15mb", // un document de 10 Mo encodé en base64
    longueurMessage: entier("MAX_MESSAGE_LENGTH", 8000),
    longueurMessageHistorique: entier("MAX_HISTORY_MESSAGE_LENGTH", 20000), // les réponses du modèle peuvent être longues
    messagesHistorique: entier("MAX_HISTORY_MESSAGES", 20), // nombre pair : paires question/réponse
    caracteresDocument: entier("MAX_DOCUMENT_CHARS", 60000),
  },
};
