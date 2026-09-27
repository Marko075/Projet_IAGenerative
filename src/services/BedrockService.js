// Service d'accès au modèle (AWS Bedrock, API Converse) : seul fichier qui parle au fournisseur d'IA.
// Changer de fournisseur ne toucherait que ce fichier (et la configuration).
// Il gère aussi l'extraction du texte des documents joints avant de les envoyer au modèle.
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { OfficeParser } from "officeparser";
import { config } from "../config.js";
import { AppError, traduireErreurBedrock } from "../errors.js";

// Client Bedrock unique. maxAttempts : le SDK refait automatiquement une tentative
// en cas d'erreur temporaire (surcharge, erreur réseau).
const client = new BedrockRuntimeClient({
  region: config.awsRegion,
  maxAttempts: config.bedrock.tentativesMax,
});

// Convertit { role, content: "texte" } au format attendu par l'API Converse.
function versMessageConverse({ role, content }) {
  return { role, content: [{ text: content }] };
}

// Combine le timeout et un éventuel signal d'annulation (client qui se déconnecte).
function signalAppel(signal) {
  const timeout = AbortSignal.timeout(config.bedrock.timeoutMs);
  if (!signal) return timeout;
  return typeof AbortSignal.any === "function" ? AbortSignal.any([timeout, signal]) : signal;
}

// ---------- Conversation : historique + nouveau message ----------
// Envoie au modèle : le prompt système, l'historique (déjà borné) et le nouveau message.
// Renvoie { texte, tronquee, usage } ; toute erreur est traduite en AppError lisible.
export async function askBedrock(historique, message, { signal } = {}) {
  const command = new ConverseCommand({
    modelId: config.modele.id,
    system: [{ text: config.modele.promptSysteme }],
    messages: [...historique, { role: "user", content: message }].map(versMessageConverse),
    inferenceConfig: {
      maxTokens: config.modele.maxTokens,
      temperature: config.modele.temperature,
    },
  });

  let response;
  try {
    response = await client.send(command, {
      abortSignal: signalAppel(signal),
    });
  } catch (err) {
    console.error(`[bedrock] ${err.name}: ${err.message}`);
    throw traduireErreurBedrock(err);
  }

  // Le modèle peut renvoyer plusieurs blocs (ex. raisonnement puis réponse) : on ne garde que le texte.
  const texte = (response.output?.message?.content ?? [])
    .filter((bloc) => typeof bloc.text === "string")
    .map((bloc) => bloc.text)
    .join("")
    .trim();

  if (!texte) {
    throw new AppError(502, "EMPTY_RESPONSE", "Le modèle n'a renvoyé aucune réponse.");
  }

  // tronquee : le modèle s'est arrêté sur la limite de tokens (réponse incomplète, signalée à l'utilisateur).
  // usage : tokens consommés, utile pour suivre le coût.
  return {
    texte,
    tronquee: response.stopReason === "max_tokens",
    usage: {
      inputTokens: response.usage?.inputTokens ?? 0,
      outputTokens: response.usage?.outputTokens ?? 0,
    },
  };
}

// ---------- Documents joints (PDF, Word, Excel, PowerPoint) ----------
// Le modèle ne lit que du texte : officeparser extrait le texte brut du fichier
// (le type vient de l'extension, validée en amont dans validation.js).
async function extraireTexteDocument(fichierBase64, type) {
  try {
    const ast = await OfficeParser.parseOffice(Buffer.from(fichierBase64, "base64"), { fileType: type });
    return (await ast.to("text")).value.trim();
  } catch (err) {
    console.error(`[document ${type}] ${err.name}: ${err.message}`);
    throw new AppError(400, "INVALID_DOCUMENT", `Impossible de lire ce fichier ${config.formatsDocument[type]}.`);
  }
}

// Construit un prompt « contenu du document + consigne de l'utilisateur » et l'envoie au modèle.
// Le texte est tronqué au-delà de MAX_DOCUMENT_CHARS pour rester dans la fenêtre de contexte (et le budget).
export async function resumerDocument(fichierBase64, { nom, type }, messageUtilisateur, { historique = [], signal } = {}) {
  let texteExtrait = await extraireTexteDocument(fichierBase64, type);
  if (!texteExtrait) {
    const detail = type === "pdf" ? " (un PDF scanné, sans texte sélectionnable, ne peut pas être lu)" : "";
    throw new AppError(400, "EMPTY_DOCUMENT", `Ce document ne contient aucun texte exploitable${detail}.`);
  }

  const { caracteresDocument } = config.limites;
  const tronque = texteExtrait.length > caracteresDocument;
  if (tronque) texteExtrait = texteExtrait.slice(0, caracteresDocument);

  const prompt = `Voici le contenu extrait du document ${config.formatsDocument[type]} « ${nom} »${tronque ? " (tronqué car trop long)" : ""} :

${texteExtrait}

Consigne de l'utilisateur : ${messageUtilisateur || "Fais-en un résumé clair et structuré."}`;

  return askBedrock(historique, prompt, { signal });
}
