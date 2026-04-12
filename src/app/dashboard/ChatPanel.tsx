"use client";

import { useState, useRef, useEffect } from "react";

// ── Static data ────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  {
    title: "Explain my latest blood test",
    subtitle: "Review the CBC results from my last visit",
  },
  {
    title: "Check for drug interactions",
    subtitle: "Between my current medications",
  },
  {
    title: "Prepare for my appointment",
    subtitle: "Help me write questions for my doctor",
  },
];

type Message = { role: "user" | "assistant"; content: string };

const SAMPLE_THREAD: Message[] = [
  { role: "user", content: "Can you review my recent CBC blood test results?" },
  {
    role: "assistant",
    content:
      "Based on your Complete Blood Count from December 2, 2022, I can see a few notable findings. Your Haemoglobin is 12.5 g/dL, which is slightly below the reference range of 13.0–17.0 g/dL. Your WBC count and Platelet count are both within their normal reference ranges. The low haemoglobin is the most clinically relevant finding and may suggest mild anaemia. Would you like me to explain what could be causing this or what to discuss with your doctor?",
  },
  { role: "user", content: "What does the low haemoglobin mean for me?" },
  {
    role: "assistant",
    content:
      "Low haemoglobin (anaemia) means your red blood cells aren't carrying as much oxygen as usual. At 12.5 g/dL you're in the mild range, so symptoms may be subtle — occasional fatigue, mild shortness of breath with exertion, or feeling a bit run down. The most common causes are low iron, low B12 or folate, or in some cases underlying conditions. Given your otherwise normal CBC, dietary iron deficiency is a likely starting point. I'd recommend discussing iron supplementation and a follow-up test with your doctor.",
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────

function SendIcon({ size = 4 }: { size?: number }) {
  return (
    <svg className={`w-${size} h-${size}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function MicIcon({ size = 4 }: { size?: number }) {
  return (
    <svg className={`w-${size} h-${size}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function AssistantAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .194.01.386.029.576M14.25 3.104c.24.028.48.057.718.09m-.718-.09a24.301 24.301 0 014.5 0M5 14.5L3 19.5M19 19.5l-2-5M5 14.5l4.091-4.091m5.818 0L19 14.5" />
      </svg>
    </div>
  );
}

// ── Chat input box (shared between idle + active) ──────────────────────────

function ChatInput({
  value,
  onChange,
  onSend,
  placeholder,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  rows?: number;
}) {
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-5 pt-4 pb-2 text-gray-800 placeholder-gray-400 resize-none border-none focus:ring-0 focus:outline-none text-base leading-relaxed"
      />
      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        {/* Left actions */}
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Attach file">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <div className="w-px h-4 bg-gray-200 mx-0.5" />
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Select model">
            {/* Diamond / model icon */}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 6.375c0 8.284-7.164 15-16 15S-2 14.659 0 6.375m12.75 0c0 8.284-5.596 15-12.5 15S0 14.659 0 6.375m0 0c0-3.728 5.596-6.375 12.5-6.375S25 2.647 25 6.375m-3.75-1.875L12 12 3.75 4.5" />
            </svg>
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Dictate">
            <MicIcon />
          </button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Voice mode">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </button>
          <button
            onClick={onSend}
            disabled={!value.trim()}
            title="Send"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-900 text-white hover:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const isIdle = messages.length === 0;

  function send() {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    // Static placeholder reply
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I can see your health records. This consultation feature will be fully connected to your timeline and AI provider in an upcoming update.",
        },
      ]);
    }, 600);
  }

  function loadSample() {
    setMessages(SAMPLE_THREAD);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Idle state ─────────────────────────────────────────────────────────

  if (isIdle) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8 pb-12 bg-white">
        <div className="w-full max-w-xl">
          <p className="text-xl font-semibold text-gray-800 text-center mb-6">
            How can I help you today?
          </p>

          <ChatInput
            value={input}
            onChange={setInput}
            onSend={send}
            placeholder="Ask about your health records…"
            rows={2}
          />

          {/* Suggestions */}
          <div className="mt-8">
            <div className="flex items-center gap-1.5 mb-5 text-gray-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wide">Suggested</span>
            </div>
            <div className="space-y-5">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput(s.title)}
                  className="block w-full text-left group"
                >
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                    {s.title}
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5">{s.subtitle}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Dev helper */}
          <button
            onClick={loadSample}
            className="mt-10 text-xs text-gray-300 hover:text-gray-400 transition-colors w-full text-center"
          >
            Load sample chat
          </button>
        </div>
      </div>
    );
  }

  // ── Active chat state ──────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[72%] bg-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-800 leading-relaxed">
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <AssistantAvatar />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 mb-1.5">
                  Health Assistant
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-100 px-6 py-4">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={send}
          placeholder="Ask a follow-up…"
          rows={1}
        />
      </div>
    </div>
  );
}
