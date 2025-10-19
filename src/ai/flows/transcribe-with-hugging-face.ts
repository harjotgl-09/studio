'use server';

/**
 * @fileOverview Calls a Hugging Face endpoint to transcribe an audio recording.
 *
 * - transcribeWithHuggingFace - a function that sends audio data to the Hugging Face Inference API.
 * - TranscribeWithHuggingFaceInput - The input type for the function.
 * - TranscribeWithHuggingFaceOutput - The return type for the function.
 */

import { z } from 'zod';

const TranscribeWithHuggingFaceInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "The audio recording as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type TranscribeWithHuggingFaceInput = z.infer<
  typeof TranscribeWithHuggingFaceInputSchema
>;

const TranscribeWithHuggingFaceOutputSchema = z.object({
  transcription: z
    .string()
    .describe('The transcribed text from the audio recording.'),
});
export type TranscribeWithHuggingFaceOutput = z.infer<
  typeof TranscribeWithHuggingFaceOutputSchema
>;

const MODEL_URL =
  'https://api-inference.huggingface.co/models/openai/whisper-large-v3';

export async function transcribeWithHuggingFace(
  input: TranscribeWithHuggingFaceInput
): Promise<TranscribeWithHuggingFaceOutput> {
  const { audioDataUri } = input;

  if (!process.env.HUGGING_FACE_API_TOKEN) {
    throw new Error(
      'Hugging Face API token is not configured. Please add HUGGING_FACE_API_TOKEN to your .env file.'
    );
  }

  // Convert data URI to Blob
  const fetchResponse = await fetch(audioDataUri);
  const audioBlob = await fetchResponse.blob();

  const response = await fetch(MODEL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HUGGING_FACE_API_TOKEN}`,
      'Content-Type': audioBlob.type,
    },
    body: audioBlob,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Hugging Face API Error:', errorBody);
    throw new Error(
      `Failed to transcribe audio. Status: ${response.status}. Body: ${errorBody}`
    );
  }

  const result = await response.json();
  
  const transcription = result.text || '';

  return { transcription };
}
