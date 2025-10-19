'use server';

/**
 * @fileOverview Calls a Hugging Face endpoint to synthesize audio from text.
 *
 * - synthesizeSpeechWithHuggingFace - a function that sends text data to the Hugging Face Inference API.
 * - SynthesizeSpeechInput - The input type for the function.
 * - SynthesizeSpeechOutput - The return type for the function.
 */

import { z } from 'zod';

const SynthesizeSpeechInputSchema = z.object({
  text: z.string().describe('The text to synthesize into speech.'),
});
export type SynthesizeSpeechInput = z.infer<
  typeof SynthesizeSpeechInputSchema
>;

const SynthesizeSpeechOutputSchema = z.object({
  audioDataUri: z
    .string()
    .describe('The synthesized audio as a data URI.'),
});
export type SynthesizeSpeechOutput = z.infer<
  typeof SynthesizeSpeechOutputSchema
>;

const MODEL_URL = 'https://aunedt9dpzdps14i.us-east-1.aws.endpoints.huggingface.cloud';

export async function synthesizeSpeechWithHuggingFace(
  input: SynthesizeSpeechInput
): Promise<SynthesizeSpeechOutput> {
  const { text } = input;

  if (!process.env.HUGGING_FACE_API_TOKEN) {
    throw new Error(
      'Hugging Face API token is not configured. Please add HUGGING_FACE_API_TOKEN to your .env file.'
    );
  }

  const response = await fetch(MODEL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HUGGING_FACE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Hugging Face API Error:', errorBody);
    throw new Error(`Failed to synthesize audio. Status: ${response.status}. Body: ${errorBody}`);
  }

  const audioBlob = await response.blob();
  const reader = new FileReader();
  
  return new Promise((resolve, reject) => {
    reader.onloadend = () => {
      resolve({ audioDataUri: reader.result as string });
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });
}
