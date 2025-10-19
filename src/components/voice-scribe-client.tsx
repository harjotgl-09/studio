"use client";

import { improveTranscriptionAccuracy } from "@/ai/flows/improve-transcription-accuracy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Check, Copy, LoaderCircle, Mic, Play, RefreshCw, Square, Voicemail, Wand2 } from "lucide-react";
import { useEffect, useRef, useState, type FC } from "react";

type Status = "initial" | "recording" | "processing" | "success" | "improving" | "error";

export const VoiceScribeClient: FC = () => {
  const [status, setStatus] = useState<Status>("initial");
  const [rawTranscription, setRawTranscription] = useState<string>("");
  const [improvedTranscription, setImprovedTranscription] = useState<string>("");
  const [audioURL, setAudioURL] = useState<string>("");
  const [audioDataUri, setAudioDataUri] = useState<string>("");
  const [isCopied, setIsCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any | null>(null);
  const { toast } = useToast();

  const [SpeechRecognition, setSpeechRecognition] = useState<any>(null);

  useEffect(() => {
    setSpeechRecognition(() => window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const handleStartRecording = async () => {
    if (!SpeechRecognition) {
      toast({
        variant: 'destructive',
        title: 'Browser Not Supported',
        description:
          'Your browser does not support the Web Speech API. Please try Chrome or Safari.',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      let finalTranscript = '';
      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setRawTranscription(finalTranscript + interimTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== 'aborted') {
          toast({
            variant: "destructive",
            title: "Speech Recognition Error",
            description: `An error occurred during transcription: ${event.error}. Please try again.`,
          });
        }
        setStatus("error");
      };
      
      recognitionRef.current.onend = () => {
        if (status === 'recording') {
          handleStopRecording();
        }
      };


      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64DataUri = reader.result as string;
          setAudioDataUri(base64DataUri);
          setStatus("success");
        };
      };

      mediaRecorderRef.current.start();
      recognitionRef.current.start();
      setStatus("recording");
    } catch (error) {
      console.error("Failed to get microphone access:", error);
      toast({
        variant: "destructive",
        title: "Microphone Access Denied",
        description: "Please allow microphone access in your browser settings to record audio.",
      });
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }
    setStatus("processing");
  };

  const handleImproveTranscription = async () => {
    if (!audioDataUri || !rawTranscription) return;
    setStatus("improving");
    try {
      const result = await improveTranscriptionAccuracy({
        audioDataUri,
        originalTranscription: rawTranscription,
      });
      setImprovedTranscription(result.improvedTranscription);
    } catch (error) {
      console.error("Improvement failed:", error);
      toast({
        variant: "destructive",
        title: "Improvement Failed",
        description: "Could not improve the transcription. Please try again.",
      });
    } finally {
      setStatus("success");
    }
  };

  const handlePlayTranscription = (text: string) => {
    if ('speechSynthesis' in window && text) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  const handleReset = () => {
    setStatus("initial");
    setRawTranscription("");
    setImprovedTranscription("");
    setAudioURL("");
    setAudioDataUri("");
  };


  const renderContent = () => {
    switch (status) {
      case "initial":
      case "error":
        return (
          <div className="text-center flex flex-col items-center gap-6">
            <div className="p-8 bg-primary/10 rounded-full">
                <Voicemail size={64} className="text-primary" />
            </div>
            <h2 className="text-2xl font-semibold font-headline">Ready to Transcribe</h2>
            <p className="text-muted-foreground max-w-md">
              Press the record button to start capturing your voice. We'll transcribe it for you in seconds.
            </p>
            <Button size="lg" className="rounded-full w-48 h-16 text-lg gap-3" onClick={handleStartRecording}>
              <Mic size={24} /> Record
            </Button>
            {status === "error" && <Button variant="outline" onClick={handleReset}><RefreshCw className="mr-2"/>Try Again</Button>}
          </div>
        );
      case "recording":
        return (
          <div className="text-center flex flex-col items-center gap-6">
            <div className="p-8 bg-destructive/10 rounded-full animate-pulse">
                <Mic size={64} className="text-destructive" />
            </div>
            <h2 className="text-2xl font-semibold font-headline">Recording...</h2>
            <p className="text-muted-foreground">Speak now. Press stop when you're finished.</p>
            <Textarea readOnly value={rawTranscription || 'Listening...'} className="min-h-[100px] text-center bg-transparent border-0 text-lg" />
            <Button variant="destructive" size="lg" className="rounded-full w-48 h-16 text-lg gap-3" onClick={handleStopRecording}>
              <Square size={24} /> Stop
            </Button>
          </div>
        );
      case "processing":
        return (
          <div className="text-center flex flex-col items-center gap-4">
             <LoaderCircle size={64} className="text-primary animate-spin" />
             <h2 className="text-2xl font-semibold font-headline">Processing...</h2>
             <p className="text-muted-foreground">Finalizing your audio and transcription.</p>
          </div>
        );
      case "improving":
      case "success":
        const textToDisplay = improvedTranscription || rawTranscription;
        return (
          <Card className="w-full max-w-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline">Your Transcription</CardTitle>
              <CardDescription>
                Review your transcription, play back the audio, and use AI to improve accuracy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="mt-4">
                <audio src={audioURL} controls className="w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                    {improvedTranscription ? 'AI-Improved Transcription' : 'Transcription'}
                </label>
                <Textarea
                  readOnly
                  value={textToDisplay}
                  className="h-40 text-base bg-background"
                  aria-label="Transcription text"
                />
              </div>

              {rawTranscription && !improvedTranscription && (
                 <Button onClick={handleImproveTranscription} disabled={status === "improving"} className="w-full">
                    {status === "improving" ? (
                      <LoaderCircle className="animate-spin mr-2" />
                    ) : (
                      <Wand2 className="mr-2" />
                    )}
                    {status === "improving" ? "Improving..." : "Improve with AI"}
                  </Button>
              )}

              {improvedTranscription && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Original Transcription</label>
                  <Textarea
                    readOnly
                    value={rawTranscription}
                    className="h-28 text-base bg-secondary/30"
                    aria-label="Original transcription text"
                  />
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4">
               <Button variant="outline" onClick={handleReset}>
                <RefreshCw size={16} className="mr-2" /> Record New
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => handlePlayTranscription(textToDisplay)} aria-label="Play transcription">
                  <Play />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleCopy(textToDisplay)} aria-label="Copy transcription">
                  {isCopied ? <Check className="text-green-500" /> : <Copy />}
                </Button>
              </div>
            </CardFooter>
          </Card>
        );
    }
  };

  return (
    <div className="w-full max-w-3xl flex flex-col items-center justify-center text-center">
      {renderContent()}
    </div>
  );
};
