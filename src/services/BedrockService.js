import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import dotenv from "dotenv";
dotenv.config();

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

const MODEL_TEXTE = "zai.glm-4.7-flash";

function extraireTexte(response) {
  const blocs = response.output.message.content;
  const blocTexte = blocs.find(bloc => bloc.text);
  return blocTexte ? blocTexte.text : "Je n'ai pas réussi à générer de réponse.";
}

export async function askBedrock(prompt) {
  const command = new ConverseCommand({
    modelId: MODEL_TEXTE,
    messages: [{ role: "user", content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens: 800, temperature: 0.5 }
  });

  const response = await client.send(command);
  return extraireTexte(response);
}