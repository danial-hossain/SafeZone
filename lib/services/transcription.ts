export interface TranscriptionService {
  isAvailable(): boolean;
  start(onTranscript: (text: string) => void, onEnd: () => void, onError: (message: string) => void): { stop(): void };
}

type SpeechRecognitionResult = ArrayLike<ArrayLike<{ transcript: string }>>;
type RecognitionError = { error?: string };
type Recognition = { lang: string; interimResults: boolean; onresult: ((event: { results: SpeechRecognitionResult }) => void) | null; onerror: ((event: RecognitionError) => void) | null; onend: (() => void) | null; start(): void; stop(): void };
type RecognitionConstructor = new () => Recognition;

function describeRecognitionError(code: string | undefined) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone or speech recognition access was denied. Check this site's microphone permission and browser settings, or type your report instead.";
    case "audio-capture":
      return "No working microphone was found. Check that your microphone is connected and available, or type your report instead.";
    case "network":
      return "The browser's speech recognition service could not be reached. Check your connection or try another browser, or type your report instead.";
    case "no-speech":
      return "No speech was detected. Try again in a quieter place, or type your report instead.";
    case "language-not-supported":
      return "The browser's speech service does not support English (US). Try another browser, or type your report instead.";
    case "aborted":
      return "Speech transcription was stopped. You can try again or type your report instead.";
    default:
      return "Browser speech recognition stopped unexpectedly. You can try again or type your report instead.";
  }
}

export class BrowserTranscriptionService implements TranscriptionService {
  private getConstructor(): RecognitionConstructor | undefined {
    if (typeof window === "undefined") return undefined;
    const browser = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  }
  isAvailable() { return !!this.getConstructor(); }
  start(onTranscript: (text: string) => void, onEnd: () => void, onError: (message: string) => void) {
    const Constructor = this.getConstructor();
    if (!Constructor) throw new Error("Browser speech transcription is unavailable. You can type your report instead.");
    const recognizer = new Constructor(); recognizer.lang = "en-US"; recognizer.interimResults = true;
    recognizer.onresult = (event) => onTranscript(Array.from(event.results).map((result) => result[0].transcript).join(" "));
    recognizer.onerror = (event) => { onEnd(); onError(describeRecognitionError(event.error)); };
    recognizer.onend = onEnd; recognizer.start();
    return { stop: () => recognizer.stop() };
  }
}
