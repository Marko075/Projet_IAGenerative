import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import dotenv from "dotenv";
dotenv.config();

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

const MODEL_ID = "zai.glm-4.7-flash"; // vérifie l'ID exact copié depuis la console Bedrock

export async function askBedrock(prompt) {
  const command = new ConverseCommand({
    modelId: MODEL_ID,
    messages: [
      {
        role: "user",
        content: [{ text: prompt }]
      }
    ],
    inferenceConfig: {
      maxTokens: 512,
      temperature: 0.5
    }
  });

  const response = await client.send(command);
  return response.output.message.content[0].text;
}