'use client';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Square, Loader2, Play, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/header';
import { transcribeWithHuggingFace } from '@/ai/flows/transcribe-with-hugging-face';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [browserTranscription, setBrowserTranscription] = useState('');
  const [aiTranscription, setAiTranscription] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          setBrowserTranscription(finalTranscript + interimTranscript);
        };
        recognitionRef.current = recognition;
      } else {
        console.warn("SpeechRecognition API not supported in this browser.");
      }
    }
  }, []);


  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(audioUrl);
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setBrowserTranscription('');
      setAiTranscription('');
      setTranscriptionError(null);

      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not start recording. Please ensure you have given microphone permissions.",
      });
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  };
  
  const handleTranscribe = async () => {
    if (audioChunksRef.current.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No audio recorded to transcribe.',
      });
      return;
    }

    setIsTranscribing(true);
    setAiTranscription('');
    setTranscriptionError(null);

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        try {
          const result = await transcribeWithHuggingFace({ audioDataUri: base64Audio });
          setAiTranscription(result);
        } catch (error: any) {
           console.error('Error in transcription flow:', error);
           const errorMessage = error.message || "An unknown error occurred during transcription.";
           setTranscriptionError(errorMessage);
           toast({
             variant: "destructive",
             title: "Transcription Failed",
             description: `There was a problem communicating with the AI model. ${errorMessage}`,
           });
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (error) {
      console.error('Error during transcription preparation:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to prepare audio for transcription.",
      });
      setIsTranscribing(false);
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Voice Transcription</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
              <div className="flex items-center gap-4">
                <Button
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  size="lg"
                  className="w-32"
                >
                  {isRecording ? <Square className="mr-2" /> : <Mic className="mr-2" />}
                  {isRecording ? 'Stop' : 'Record'}
                </Button>
                <Button
                  onClick={handleTranscribe}
                  size="lg"
                  disabled={isRecording || isTranscribing || !audioUrl}
                  className="w-48"
                >
                  {isTranscribing ? (
                    <Loader2 className="mr-2 animate-spin" />
                  ) : (
                    <Play className="mr-2" />
                  )}
                  {isTranscribing ? 'Transcribing...' : 'Transcribe with AI'}
                </Button>
              </div>
              
              {audioUrl && (
                <div className="w-full">
                    <audio controls src={audioUrl} className="w-full" />
                </div>
              )}

              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Browser Transcription</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[150px] text-muted-foreground">
                    <ScrollArea className="h-full w-full rounded-md border p-4">
                      {browserTranscription || "Live transcription will appear here..."}
                    </ScrollArea>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">AI Transcription</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[150px] text-foreground font-semibold">
                     <ScrollArea className="h-full w-full rounded-md border p-4">
                      {isTranscribing && <div className="text-muted-foreground">Transcribing...</div>}
                      {aiTranscription}
                      {transcriptionError && (
                         <div className="text-destructive flex flex-col items-center text-center gap-2 p-4 rounded-md border border-destructive/50 bg-destructive/10">
                           <AlertTriangle className="w-8 h-8" />
                           <h3 className="font-bold">Configuration Error</h3>
                           <p className="text-sm font-normal">{transcriptionError}</p>
                         </div>
                      )}
                      {!aiTranscription && !isTranscribing && !transcriptionError && <div className="text-muted-foreground font-normal">AI transcription result will appear here.</div>}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
