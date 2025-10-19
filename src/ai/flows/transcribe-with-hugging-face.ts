'use server';

/**
 * @fileOverview Transcribes audio using a specific Hugging Face model.
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
      'The audio data as a data URI that must include a MIME type and use Base64 encoding.'
    ),
});
export type TranscribeWithHuggingFaceInput = z.infer<
  typeof TranscribeWithHuggingFaceInputSchema
>;

const TranscribeWithHuggingFaceOutputSchema = z.object({
  transcription: z.string().describe('The transcribed text.'),
});
export type TranscribeWithHuggingFaceOutput = z.infer<
  typeof TranscribeWithHuggingFaceOutputSchema
>;

const MODEL_URL = 'https://iyr9a23kqm3iv1xh.us-east-1.aws.endpoints.huggingface.cloud';

export async function transcribeWithHuggingFace(
  input: TranscribeWithHuggingFaceInput
): Promise<TranscribeWithHuggingFaceOutput> {
  const { audioDataUri } = input;

  if (!process.env.HUGGING_FACE_API_TOKEN) {
    throw new Error(
      'Hugging Face API token is not configured. Please add HUGGING_FACE_API_TOKEN to your .env file.'
    );
  }

  // Extract base64 data from data URI
  const base64Data = audioDataUri.split(',')[1];
  if (!base64Data) {
    throw new Error('Invalid audio data URI.');
  }
  const audioBuffer = Buffer.from(base64Data, 'base64');

  const response = await fetch(MODEL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HUGGING_FACE_API_TOKEN}`,
      'Content-Type': 'audio/webm',
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Hugging Face API Error:', errorBody);
    throw new Error(`Failed to transcribe audio. Status: ${response.status}. Body: ${errorBody}`);
  }

  const result = await response.json();
  
  if (result.error) {
     throw new Error(`Hugging Face model error: ${result.error}`);
  }

  // The dedicated endpoint returns the transcription in a different format
  const transcription = Array.isArray(result) && result[0] && result[0].generated_text
    ? result[0].generated_text
    : (result.text || '');

  return {
    transcription: transcription,
  };
}
