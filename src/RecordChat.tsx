import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Sparkles,
  Mic,
  Send,
  Volume2,
  Square,
  ArrowUpRight,
  ShieldCheck,
  Database,
} from "lucide-react";
import type { ChatAnswer, Workspace } from "../shared/types";
import { post } from "./lib/api";
import { Modal, Busy } from "./components";
import ClinicalAnswer from "./ClinicalAnswer";
import "./clinical-answer.css";

interface SpeechResult {
  0: { transcript: string };
  isFinal: boolean;
}
interface BrowserRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserRecognition;
  webkitSpeechRecognition?: new () => BrowserRecognition;
};
interface Message {
  question: string;
  response: ChatAnswer;
}

export default function RecordChat({
  workspace: w,
  onOpen,
  requireKnowledgeBase = false,
}: {
  workspace: Workspace;
  onOpen: (id: string) => void;
  requireKnowledgeBase?: boolean;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const voiceStop = useRef<((send?: boolean) => void) | null>(null);
  const cloudAudio = useRef<HTMLAudioElement | null>(null);
  const generation = useRef(0);
  const recognition = useRef<BrowserRecognition | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const formInput = useRef<HTMLTextAreaElement>(null);
  const signature = `${w.patient.id}|${w.consent.version}|${w.records.map((r) => `${r.id}-${r.version}`).join(",")}|${w.hospitals.map((h) => h.status).join(",")}`;
  useEffect(() => {
    generation.current++;
    voiceStop.current?.(false);
    cloudAudio.current?.pause();
    setMessages([]);
    setInput("");
    setSending(false);
    setError("");
    recognition.current?.abort();
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setListening(false);
  }, [signature]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, sending]);
  useEffect(
    () => () => {
      generation.current++;
      voiceStop.current?.(false);
      cloudAudio.current?.pause();
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  async function send(value = input) {
    const text = value.trim();
    if (!text || sending) return;
    const version = generation.current;
    setSending(true);
    setError("");
    setInput("");
    try {
      const response = await post<ChatAnswer>(
        `/patients/${w.patient.id}/chat`,
        { message: text, requireKnowledgeBase },
      );
      if (generation.current === version)
        setMessages((previous) => [...previous, { question: text, response }]);
    } catch (err) {
      if (generation.current === version) {
        setError((err as Error).message);
        setInput(text);
      }
    } finally {
      if (generation.current === version) setSending(false);
    }
  }
  async function cloudMic() {
    if (listening) { voiceStop.current?.(); return; }
    if (sending || !w.access.allowed) { setError("Confirm identity and permission before speaking."); return; }
    const version = generation.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false });
      if (generation.current !== version) { media.getTracks().forEach(track => track.stop()); return; }
      const context = new AudioContext(), source = context.createMediaStreamSource(media), processor = context.createScriptProcessor(4096, 1, 1), mute = context.createGain();
      const chunks: Float32Array[] = []; mute.gain.value = 0; source.connect(processor); processor.connect(mute); mute.connect(context.destination);
      processor.onaudioprocess = event => chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      let stopped = false;
      const stop = (send = true) => {
        if (stopped) return; stopped = true; clearTimeout(timer); processor.disconnect(); source.disconnect(); mute.disconnect(); media.getTracks().forEach(track => track.stop()); setListening(false);
        const samples = new Float32Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0)); let at = 0;
        for (const chunk of chunks) { samples.set(chunk, at); at += chunk.length; }
        const ratio = context.sampleRate / 16000, pcm = new Int16Array(Math.floor(samples.length / ratio));
        for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, samples[Math.floor(i * ratio)])) * 32767);
        void context.close();
        if (!send || generation.current !== version || !pcm.length) return;
        const bytes = new Uint8Array(pcm.buffer); let binary = "";
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        setSending(true); setError("");
        void post<ChatAnswer & { transcript: string; audioBase64?: string; audioContentType?: string }>("/comparison/voice", { audioBase64: btoa(binary), sampleRate: 16000 }).then(response => {
          if (generation.current !== version) return;
          setMessages(previous => [...previous, { question: response.transcript || "Voice question", response }]);
          if (response.audioBase64) { const player = new Audio(`data:${response.audioContentType};base64,${response.audioBase64}`); cloudAudio.current = player; void player.play().catch(() => setError("The answer is ready; automatic audio playback was blocked.")); }
        }).catch(error => { if (generation.current === version) setError((error as Error).message); }).finally(() => { if (generation.current === version) setSending(false); });
      };
      const timer = setTimeout(() => stop(), 20000); voiceStop.current = stop; setListening(true);
    } catch (error) { setError((error as Error).message); }
  }
  function startMic() {
    setNotice(false);
    const Ctor =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Ctor) {
      setError(
        "Speech recognition is unavailable in this browser. You can still type your question.",
      );
      return;
    }
    const rec = new Ctor();
    recognition.current = rec;
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");
      setInput(transcript);
      formInput.current?.focus();
    };
    rec.onerror = (e) => {
      setListening(false);
      setError(
        e.error === "not-allowed"
          ? "Microphone permission was denied. Type your question or enable microphone access in browser settings."
          : `Browser voice could not finish (${e.error}). Please type your question.`,
      );
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Microphone could not start. Type your question instead.");
    }
  }
  function speak(text: string) {
    if (!("speechSynthesis" in window)) {
      setError("Spoken playback is unavailable in this browser.");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-IN";
    speech.rate = 0.98;
    speech.onend = () => setSpeaking(false);
    speech.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(speech);
    setSpeaking(true);
  }
  return (
    <section className="panel chat-panel">
      <div className="panel-heading">
        <h2>
          <MessageSquare size={20} />
          Ask the record
        </h2>
      </div>
      <div className="chat-description">
        <div>
          <Database size={18} />
          <strong>
            {["bedrock", "bedrock-kb"].includes(messages.at(-1)?.response.mode ?? "")
              ? "Amazon Bedrock"
              : requireKnowledgeBase ? "Zuma · source-linked answers" : "Structured evidence answers"}
          </strong>
          <span>
            <span className="status-dot" />
            {requireKnowledgeBase && !messages.length ? "Evidence check required" : "Ready"}
          </span>
        </div>
        <p>Answers use only the permitted patient records shown here.</p>
      </div>
      <div className="chat-conversation" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <span className="assistant-mark">
              <Sparkles size={24} />
            </span>
            <h3>
              A clearer picture,
              <br />
              one question away.
            </h3>
            <p>
              Explore {w.records.length} available records from{" "}
              {w.metrics.hospitals}{" "}
              {w.metrics.hospitals === 1 ? "hospital" : "hospitals"}.
            </p>
            <div className="prompt-list">
              {[
                "Summarize the available records",
                "What changed between visits?",
                "Which records conflict?",
              ].map((q) => (
                <button
                  key={q}
                  disabled={sending || !w.records.length}
                  onClick={() => send(q)}
                >
                  {q}
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div className="chat-exchange" key={message.response.id}>
            <div className="user-message">{message.question}</div>
            <div className="assistant-row">
              <span className="assistant-mark">
                <Sparkles size={17} />
              </span>
              <div className="assistant-message">
                <ClinicalAnswer text={message.response.answer} />
                {message.response.citations.length > 0 && (
                  <div className="chat-sources">
                    <span className="label">Sources</span>
                    {message.response.citations.map((c) => (
                      <button key={c.id} onClick={() => onOpen(c.recordId)}>
                        <span
                          className={`hospital-dot hospital-${w.records.find(record => record.id === c.recordId)?.hospitalId ?? "B"}`}
                        >
                          {w.records.find(record => record.id === c.recordId)?.hospitalId ?? "B"}
                        </span>
                        <span>
                          <strong>{c.title}</strong>
                          <small>{c.hospital}</small>
                        </span>
                        <ArrowUpRight size={13} />
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className="subtle-link playback"
                  onClick={() => speak(message.response.answer)}
                >
                  {speaking ? <Square size={12} /> : <Volume2 size={13} />}{" "}
                  {speaking ? "Stop playback" : "Read aloud"}
                </button>
                <p className="answer-warning">{message.response.warning}</p>
              </div>
            </div>
          </div>
        ))}
        {sending && <Busy label="Checking the permitted evidence…" />}
        <div ref={bottom} />
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="chat-composer">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="record-question">
            Ask a question about this patient’s records
          </label>
          <textarea
            ref={formInput}
            id="record-question"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              listening
                ? "Listening…"
                : "Ask a question about this patient’s records…"
            }
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="composer-actions">
            <button
              type="button"
              className={`voice-button ${listening ? "listening" : ""}`}
              aria-label={
                listening ? "Stop listening" : requireKnowledgeBase ? "Ask Zuma by voice" : "Use browser microphone"
              }
              onClick={() => {
                if (requireKnowledgeBase) { void cloudMic(); return; }
                if (listening) recognition.current?.stop();
                else setNotice(true);
              }}
            >
              {listening ? <Square size={18} /> : <Mic size={19} />}
            </button>
            <button
              type="submit"
              className="send-button"
              aria-label="Send question"
              disabled={!input.trim() || sending}
            >
              <Send size={17} />
            </button>
          </div>
        </form>
        <div className="composer-caption">
          <span>
            <Mic size={12} />
            {requireKnowledgeBase ? "Voice question · same permission checks" : "Browser voice · not AWS"}
          </span>
          <span>Enter to send</span>
        </div>
        <div className="chat-privacy">
          <ShieldCheck size={12} />
          <span>Synthetic records · clinician review required</span>
        </div>
      </div>
      {notice && (
        <Modal title="Use browser voice" onClose={() => setNotice(false)}>
          <div className="notice-content">
            <Mic size={32} />
            <p>
              Your browser may send microphone audio to its speech service. This
              demo contains synthetic records only.
            </p>
            <p>
              We will place the transcript in the input so you can review it
              before sending. Audio is not sent to AWS Nova Sonic.
            </p>
            <button className="button primary" onClick={startMic}>
              <Mic size={16} />
              Start microphone
            </button>
            <button className="button" onClick={() => setNotice(false)}>
              Keep typing
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
