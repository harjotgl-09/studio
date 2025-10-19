'use server';
/**
 * @fileOverview A flow that transcribes audio using a Hugging Face Inference Endpoint.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const TranscribeInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "A recording, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});

export async function transcribeWithHuggingFace(
  input: z.infer<typeof TranscribeInputSchema>
): Promise<string> {
  const model = 'openai/whisper-large-v3';

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: input.audioDataUri,
      }
    );

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Hugging Face API Error:", errorBody);
        throw new Error(`Failed to transcribe audio. Status: ${response.status}. Body: ${errorBody}`);
    }
    
    const result = await response.json();
    
    // Log the full response to see its structure
    console.log("Hugging Face API Response:", JSON.stringify(result, null, 2));

    if (result && result.text) {
        return result.text;
    } else if (result && Array.isArray(result) && result[0] && result[0].generated_text) {
        // Handle cases where the response is an array with a single object
        return result[0].generated_text;
    } else {
        // Handle cases where the transcription is directly in the root object
        const transcription = result.generated_text || result.text;
        if(typeof transcription === 'string') {
          return transcription;
        }
        throw new Error('Transcription not found in the expected format.');
    }

  } catch (error: any) {
    console.error("Error in transcribeWithHuggingFace flow:", error);
    throw new Error(error.message || 'An unexpected error occurred during transcription.');
  }
}