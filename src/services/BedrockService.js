import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import officeParser from "officeparser";
import dotenv from "dotenv";
dotenv.config();

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

const MODEL_TEXTE = "zai.glm-4.7-flash";       // pour le texte simple et les PowerPoint résumés
const MODEL_VISION = "zai.glm-4.6v-flash";     // pour les images

// ---------- Extraction robuste du texte depuis la réponse Bedrock ----------
function extraireTexte(response) {
  const blocs = response.output.message.content;
  console.log("Contenu brut renvoyé par le modèle :", JSON.stringify(blocs, null, 2));

  const blocTexte = blocs.find(bloc => bloc.text);
  return blocTexte ? blocTexte.text : "Je n'ai pas réussi à générer de réponse.";
}

// ---------- Appel simple (texte seul, ou texte + image) ----------
export async function askBedrock(prompt, imageBase64 = null) {
  const content = [{ text: prompt }];
  let modelId = MODEL_TEXTE;

  if (imageBase64) {
    modelId = MODEL_VISION;
    content.push({
      image: {
        format: "png",
        source: { bytes: Buffer.from(imageBase64, "base64") }
      }
    });
  }

  const command = new ConverseCommand({
    modelId,
    messages: [{ role: "user", content }],
    inferenceConfig: { maxTokens: 800, temperature: 0.5 }
  });

  const response = await client.send(command);
  return extraireTexte(response);
}

// ---------- Résumé d'un PowerPoint ----------
export async function resumerPowerPoint(fichierBase64, messageUtilisateur) {
  const buffer = Buffer.from(fichierBase64, "base64");
  const texteExtrait = await officeParser.parseOfficeAsync(buffer);

  const prompt = `Voici le contenu extrait d'un document PowerPoint :\n\n${texteExtrait}\n\nConsigne de l'utilisateur : ${messageUtilisateur || "Fais-en un résumé clair et structuré."}`;

  return askBedrock(prompt);
}