"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Upload, X, Zap, BookOpen, Sparkles,
  FileText, AlertCircle, ChevronDown, ChevronUp,
  ExternalLink, Loader2, Users, Calendar, BarChart2, MessageCircle, Flame, Hash,
} from "lucide-react";

interface UploadedFile {
  name: string;
  base64: string;
  type: string;
}

interface Paper {
  title: string;
  authors: string;
  published: string;
  link: string;
  relevance: string;
  buzz: string;
  discussedOn: string;
  why: string;
  bullets: string[];
}

interface ParsedResult {
  papers: Paper[];
  summary: string;
}

const SUGGESTED_TOPICS = [
  "RAG", "LLM agents", "memory in LLMs", "chain-of-thought",
  "multimodal models", "RLHF", "fine-tuning", "vector databases",
];

const CARD_THEMES = [
  { accent: "#a78bfa", glow: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.25)", tag: "rgba(167,139,250,0.1)" },
  { accent: "#60a5fa", glow: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.25)",  tag: "rgba(96,165,250,0.1)"  },
  { accent: "#34d399", glow: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.25)",  tag: "rgba(52,211,153,0.1)"  },
  { accent: "#fb923c", glow: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.25)",  tag: "rgba(251,146,60,0.1)"  },
];

// ── Parser ────────────────────────────────────────────────────────────────────

function parseOutput(text: string): ParsedResult {
  const papers: Paper[] = [];

  // Split on the ━━━ horizontal rule lines
  const parts = text.split(/━+/);

  // Each paper occupies 3 consecutive parts: divider | title | content | divider
  // We look for blocks that contain 📄
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part.startsWith("📄") && !part.includes("📄")) continue;

    const title = part.replace(/^📄\s*/, "").trim();
    const body = parts[i + 1]?.trim() ?? "";
    if (!body) continue;

    const lines = body.split("\n").map((l) => l.trim());

    const get = (emoji: string) => {
      const line = lines.find((l) => l.startsWith(emoji));
      return line ? line.replace(emoji, "").replace(/^[:\s]+/, "").trim() : "";
    };

    const authors    = get("👤").replace(/^Authors:\s*/i, "");
    const published  = get("📅").replace(/^Published:\s*/i, "");
    const link       = get("🔗").replace(/^Link:\s*/i, "");
    const scoreRaw   = get("📊").replace(/^Relevance Score:\s*/i, "");
    const discussedOn = get("💬").replace(/^Discussed on:\s*/i, "");

    const relevance = scoreRaw.match(/Relevance[^:]*:\s*([\d/]+)/i)?.[1] ?? scoreRaw.split("|")[0]?.trim() ?? "";
    const buzz      = scoreRaw.match(/Web Buzz[^:]*:\s*([\d/]+)/i)?.[1] ?? scoreRaw.split("|")[1]?.trim() ?? "";

    // Why section
    const whyStart = body.indexOf("🔥");
    const threadStart = body.indexOf("🧵");
    const why = whyStart >= 0
      ? body.slice(whyStart).split("\n").slice(1).join(" ").split("🧵")[0].trim()
      : "";

    // Community bullets
    const bullets: string[] = [];
    if (threadStart >= 0) {
      const threadBlock = body.slice(threadStart);
      const bulletLines = threadBlock.split("\n").slice(1);
      for (const bl of bulletLines) {
        const cleaned = bl.replace(/^[-•*]\s*/, "").trim();
        if (cleaned && !cleaned.startsWith("━") && !cleaned.startsWith("📌")) {
          bullets.push(cleaned);
        }
      }
    }

    papers.push({ title, authors, published, link, relevance, buzz, discussedOn, why, bullets });
    i++; // skip the body part
  }

  // Extract summary block
  const summaryMatch = text.match(/📌\s*SEARCH COVERAGE SUMMARY[:\s]*([\s\S]*?)(?:━+|$)/i);
  const summary = summaryMatch?.[1]?.trim() ?? "";

  return { papers, summary };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [query, setQuery]               = useState("");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [result, setResult]             = useState<ParsedResult | null>(null);
  const [rawText, setRawText]           = useState("");
  const [error, setError]               = useState<string | null>(null);
  const [dragOver, setDragOver]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef     = useRef<AbortController | null>(null);

  const addTopic = (topic: string) => {
    setQuery((prev) => {
      const existing = prev.trim();
      if (existing.toLowerCase().includes(topic.toLowerCase())) return prev;
      return existing ? `${existing}, ${topic}` : topic;
    });
  };

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setUploadedFile({ name: file.name, base64: e.target?.result as string, type: file.type });
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setResult(null);
    setRawText("");
    setError(null);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          fileBase64: uploadedFile?.base64 ?? null,
          fileName:   uploadedFile?.name  ?? null,
          fileType:   uploadedFile?.type  ?? null,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Request failed"); }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const answer = data.answer ?? "";
      setRawText(answer);
      setResult(parseOutput(answer));
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => { abortRef.current?.abort(); setIsLoading(false); };

  const hasParsed = result && result.papers.length > 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080808" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-xl"
        style={{ background: "rgba(8,8,8,0.85)" }}>
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-white">PaperPulse</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
            style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
            Powered by Dify · ArXiv
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
        {/* Hero */}
        <motion.div className="text-center mb-10"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs mb-5"
            style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.18)", color: "#a78bfa" }}>
            <Sparkles size={11} /> AI-powered research discovery
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight leading-tight">
            <span className="gradient-text">What's the internet saying</span>
            <br /><span className="text-white">about research?</span>
          </h1>
          <p className="text-sm max-w-lg mx-auto leading-relaxed" style={{ color: "#6b7280" }}>
            Type topics you care about. Get the most-discussed papers with rich community threads —
            findings, reactions, debates, and criticisms.
          </p>
        </motion.div>

        {/* Search box */}
        <motion.div className="mb-8"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <div className="rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex gap-2 items-start p-4">
              <Search size={15} className="mt-3 ml-0.5 shrink-0" style={{ color: "#4b5563" }} />
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSearch(); } }}
                placeholder="e.g. RAG, agents, memory in LLMs, chain-of-thought reasoning..."
                className="flex-1 bg-transparent resize-none outline-none text-sm text-white placeholder:text-zinc-600 min-h-[56px] pt-2.5 leading-relaxed"
                rows={2}
              />
              {query && (
                <button onClick={() => setQuery("")} className="mt-2.5 shrink-0 p-1 rounded hover:bg-white/10 transition-colors">
                  <X size={13} style={{ color: "#6b7280" }} />
                </button>
              )}
            </div>

            {/* File drop */}
            <div className="mx-4 mb-3 rounded-xl border-dashed border transition-all cursor-pointer"
              style={{ padding: "8px 12px", borderColor: dragOver ? "#7c3aed" : "rgba(255,255,255,0.08)", background: dragOver ? "rgba(124,58,237,0.08)" : "transparent" }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploadedFile && fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept=".pdf,.txt,.doc,.docx" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {uploadedFile ? (
                <div className="flex items-center gap-2">
                  <FileText size={13} style={{ color: "#a78bfa" }} />
                  <span className="text-xs text-zinc-300 truncate flex-1">{uploadedFile.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }} className="p-0.5 rounded hover:bg-white/10">
                    <X size={11} style={{ color: "#6b7280" }} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Upload size={12} style={{ color: "#374151" }} />
                  <span className="text-xs" style={{ color: "#374151" }}>Upload a reference paper (optional) · PDF, DOC, TXT</span>
                </div>
              )}
            </div>

            {/* Bottom row */}
            <div className="px-4 pb-4 flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_TOPICS.map((topic) => (
                  <button key={topic} onClick={() => addTopic(topic)}
                    className="text-xs px-2.5 py-1 rounded-full transition-all"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280" }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#a78bfa"; (e.target as HTMLElement).style.borderColor = "rgba(124,58,237,0.4)"; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#6b7280"; (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}>
                    {topic}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 shrink-0">
                {isLoading && (
                  <button onClick={handleStop} className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                    Stop
                  </button>
                )}
                <button onClick={handleSearch} disabled={isLoading || !query.trim()}
                  className="text-xs px-4 py-1.5 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", color: "white" }}>
                  {isLoading ? <><Loader2 size={12} className="animate-spin" /> Researching…</> : "Discover →"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 flex items-center gap-3 p-4 rounded-xl"
              style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={15} style={{ color: "#f87171" }} />
              <p className="text-sm" style={{ color: "#fca5a5" }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        <AnimatePresence>
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <LoadingState />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {!isLoading && hasParsed && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs" style={{ color: "#4b5563" }}>
                  Found <span className="text-white font-medium">{result.papers.length}</span> top papers
                </p>
                <span className="text-xs" style={{ color: "#374151" }}>Sorted by community buzz</span>
              </div>
              <div className="space-y-6">
                {result.papers.map((paper, i) => <PaperCard key={i} paper={paper} index={i} />)}
              </div>
              {result.summary && <SummaryFooter text={result.summary} />}
            </motion.div>
          )}

          {/* Fallback raw */}
          {!isLoading && !hasParsed && rawText && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-2xl p-6 text-sm leading-7 whitespace-pre-wrap"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", color: "#9ca3af" }}>
              {rawText}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!isLoading && !result && !rawText && !error && (
          <motion.div className="text-center py-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <div className="float-animation inline-block mb-4 opacity-20">
              <BookOpen size={44} style={{ color: "#9ca3af" }} />
            </div>
            <p className="text-sm" style={{ color: "#374151" }}>
              Enter topics above to discover buzzing research papers
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}

// ── Loading state ─────────────────────────────────────────────────────────────

function LoadingState() {
  const steps = [
    "Searching ArXiv for recent papers…",
    "Scanning Reddit, Hacker News & Twitter…",
    "Ranking by community discussion…",
    "Synthesizing insights…",
  ];
  const [step, setStep] = useState(0);

  useState(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 12000);
    return () => clearInterval(id);
  });

  return (
    <>
      <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div key={i} className="w-2 h-2 rounded-full"
                style={{ background: "#7c3aed" }}
                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.25 }} />
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.span key={step} className="text-sm"
              initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
              style={{ color: "#6b7280" }}>
              {steps[step]}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex gap-2">
          {steps.map((_, i) => (
            <div key={i} className="h-0.5 flex-1 rounded-full transition-all duration-500"
              style={{ background: i <= step ? "#7c3aed" : "rgba(255,255,255,0.08)" }} />
          ))}
        </div>
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="rounded-2xl shimmer" style={{ height: "220px", border: "1px solid rgba(255,255,255,0.05)" }} />
      ))}
    </>
  );
}

// ── Paper card ────────────────────────────────────────────────────────────────

function PaperCard({ paper, index }: { paper: Paper; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const theme = CARD_THEMES[index % CARD_THEMES.length];

  const relevanceNum = parseInt(paper.relevance) || 0;
  const buzzNum      = parseInt(paper.buzz)      || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${theme.border}`, boxShadow: `0 4px 32px ${theme.glow}`, background: "rgba(12,12,14,0.95)" }}>

      {/* Top accent bar */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${theme.accent}, transparent)` }} />

      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Index bubble */}
            <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold mt-0.5"
              style={{ background: theme.tag, color: theme.accent, border: `1px solid ${theme.border}` }}>
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-base leading-snug mb-3">{paper.title}</h3>

              {/* Meta row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs mb-3">
                {paper.authors && (
                  <span className="flex items-center gap-1.5" style={{ color: "#6b7280" }}>
                    <Users size={11} style={{ color: theme.accent }} />
                    <span className="truncate max-w-[280px]">{paper.authors}</span>
                  </span>
                )}
                {paper.published && (
                  <span className="flex items-center gap-1.5" style={{ color: "#6b7280" }}>
                    <Calendar size={11} style={{ color: theme.accent }} />
                    {paper.published}
                  </span>
                )}
              </div>

              {/* Tags row */}
              <div className="flex flex-wrap gap-2">
                {paper.link && (
                  <a href={paper.link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium transition-opacity hover:opacity-80"
                    style={{ background: "rgba(96,165,250,0.1)", color: "#93c5fd", border: "1px solid rgba(96,165,250,0.25)" }}>
                    <ExternalLink size={10} /> ArXiv Paper
                  </a>
                )}
                {relevanceNum > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
                    style={{ background: theme.tag, color: theme.accent, border: `1px solid ${theme.border}` }}>
                    <BarChart2 size={10} /> Relevance {paper.relevance}
                  </span>
                )}
                {buzzNum > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(251,146,60,0.1)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.25)" }}>
                    🔥 Buzz {paper.buzz}
                  </span>
                )}
                {paper.discussedOn && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.04)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <MessageCircle size={10} /> {paper.discussedOn}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button onClick={() => setExpanded((v) => !v)}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10 mt-0.5"
            style={{ color: "#4b5563" }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}>
            <div className="px-6 pb-6 space-y-5 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>

              {/* Why section */}
              {paper.why && (
                <div className="mt-5 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${theme.border}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Flame size={13} style={{ color: "#fb923c" }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#fb923c" }}>
                      Why people are talking
                    </span>
                  </div>
                  <p className="text-sm leading-7" style={{ color: "#d1d5db" }}>{paper.why}</p>
                </div>
              )}

              {/* Community thread */}
              {paper.bullets.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Hash size={12} style={{ color: theme.accent }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.accent }}>
                      Community Thread
                    </span>
                    <div className="flex-1 h-px" style={{ background: `${theme.accent}20` }} />
                  </div>
                  <ul className="space-y-2.5">
                    {paper.bullets.map((bullet, i) => (
                      <motion.li key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-start gap-3">
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-2.5" style={{ background: theme.accent }} />
                        <span className="text-sm leading-7" style={{ color: "#9ca3af" }}>{bullet}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Summary footer ────────────────────────────────────────────────────────────

function SummaryFooter({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
      className="mt-8 rounded-2xl p-5"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">📌</span>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b7280" }}>Search Coverage</span>
      </div>
      <div className="space-y-1.5">
        {lines.map((line, i) => (
          <p key={i} className="text-xs leading-6" style={{ color: "#4b5563" }}>
            {line.replace(/^[-•]\s*/, "")}
          </p>
        ))}
      </div>
    </motion.div>
  );
}
