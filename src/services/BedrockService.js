import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { OfficeParser } from "officeparser";
import { config } from "../config.js";
import { AppError, traduireErreurBedrock } from "../errors.js";

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

  return {
    texte,
    tronquee: response.stopReason === "max_tokens",
    usage: {
      inputTokens: response.usage?.inputTokens ?? 0,
      outputTokens: response.usage?.outputTokens ?? 0,
    },
  };
}

// ---------- Résumé d'un PowerPoint ----------
async function extraireTextePowerPoint(fichierBase64) {
  try {
    const ast = await OfficeParser.parseOffice(Buffer.from(fichierBase64, "base64"), { fileType: "pptx" });
    return (await ast.to("text")).value.trim();
  } catch (err) {
    console.error(`[pptx] ${err.name}: ${err.message}`);
    throw new AppError(400, "INVALID_DOCUMENT", "Impossible de lire ce fichier PowerPoint.");
  }
}

export async function resumerPowerPoint(fichierBase64, messageUtilisateur, { historique = [], signal } = {}) {
  let texteExtrait = await extraireTextePowerPoint(fichierBase64);
  if (!texteExtrait) {
    throw new AppError(400, "EMPTY_DOCUMENT", "Ce PowerPoint ne contient aucun texte exploitable.");
  }

  const { caracteresDocument } = config.limites;
  const tronque = texteExtrait.length > caracteresDocument;
  if (tronque) texteExtrait = texteExtrait.slice(0, caracteresDocument);

  const prompt = `Voici le contenu extrait d'un document PowerPoint${tronque ? " (tronqué car trop long)" : ""} :

${texteExtrait}

Consigne de l'utilisateur : ${messageUtilisateur || "Fais-en un résumé clair et structuré."}`;

  return askBedrock(historique, prompt, { signal });
}
