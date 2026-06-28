import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { summarize, type SummaryResult } from "./lib/summarizer";
import { parseFiles, type ParsedDoc } from "./lib/parseFile";
import { initTheme, setTheme, getStoredTheme, type Theme } from "./lib/theme";
import { downloadSummaryAsPdf, downloadAllSummariesAsPdf } from "./lib/pdfExport";

type View = "summary" | "bullets" | "highlight" | "keywords";

const SAMPLE_TEXT = `Artificial intelligence is rapidly transforming the way modern businesses operate. From automating routine tasks to powering sophisticated decision-making systems, AI has become a cornerstone of digital transformation. Companies that adopt AI early often see significant improvements in efficiency, customer satisfaction, and revenue growth.

One of the most impactful applications of AI is in natural language processing. NLP enables machines to understand, interpret, and generate human language, opening the door to chatbots, virtual assistants, and automated document analysis. Large language models, in particular, have advanced the field dramatically over the past few years.

However, deploying AI responsibly requires careful consideration of ethics, bias, and data privacy. Organizations must invest in robust governance frameworks to ensure that AI systems are transparent, fair, and accountable. Failure to do so can lead to reputational damage and regulatory penalties.

Looking ahead, the next wave of AI innovation will likely focus on multimodal models that can process text, images, audio, and video simultaneously. These systems will unlock new use cases in healthcare, education, creative industries, and scientific research. The companies that succeed will be those that combine technical excellence with a strong commitment to user trust.`;

const ACCEPT = ".pdf,.docx,.pptx,.xlsx,.txt,.md,text/plain";

interface DocSummary {
  doc: ParsedDoc;
  result: SummaryResult;
}

export default function App() {
  const [docs, setDocs] = useState<ParsedDoc[]>([]);
  const [text, setText] = useState("");
  const [summaries, setSummaries] = useState<DocSummary[]>([]);
  const [combinedResult, setCombinedResult] = useState<SummaryResult | null>(null);
  const [ratio, setRatio] = useState(0.3);
  const [view, setView] = useState<View>("summary");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCombined, setShowCombined] = useState(true);
  const [theme, setThemeState] = useState<Theme>("system");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initial = initTheme();
    setThemeState(initial);

    const listener = (e: MediaQueryListEvent) => {
      if (getStoredTheme() === "system") {
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const changeTheme = (t: Theme) => {
    setTheme(t);
    setThemeState(t);
  };

  const totalDocWords = useMemo(
    () => docs.reduce((sum, d) => sum + d.words, 0),
    [docs]
  );

  const hasContent = docs.length > 0 || text.length > 0;

  const handleSummarize = useCallback(() => {
    setError("");
    if (!hasContent) {
      setError("Please paste some text or upload at least one document first.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      try {
        const perDoc: DocSummary[] = [];
        for (const doc of docs) {
          if (doc.content.trim()) {
            perDoc.push({ doc, result: summarize(doc.content, ratio) });
          }
        }
        setSummaries(perDoc);

        const allText = [...docs.map((d) => d.content), text]
          .filter(Boolean)
          .join("\n\n");
        setCombinedResult(allText ? summarize(allText, ratio) : null);

        setView("summary");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to summarize");
      } finally {
        setLoading(false);
      }
    }, 30);
  }, [docs, text, ratio, hasContent]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!files.length) return;
    setError("");
    setLoading(true);
    try {
      const parsed = await parseFiles(files);
      setDocs((prev) => [...prev, ...parsed]);
      setSummaries([]);
      setCombinedResult(null);
    } catch (e) {
      setError(
        `Could not read file(s). ${e instanceof Error ? e.message : ""}`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const removeDoc = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setSummaries((prev) => prev.filter((s) => s.doc.id !== id));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const copyAll = async () => {
    const lines: string[] = [];
    summaries.forEach(({ doc, result }) => {
      lines.push(`# ${doc.name}`);
      if (view === "bullets") {
        result.bullets.forEach((b, i) => lines.push(`${i + 1}. ${b}`));
      } else {
        lines.push(result.summary);
      }
      lines.push("");
    });
    if (combinedResult && showCombined) {
      lines.push("# Combined Summary");
      if (view === "bullets") {
        combinedResult.bullets.forEach((b, i) => lines.push(`${i + 1}. ${b}`));
      } else {
        lines.push(combinedResult.summary);
      }
    }
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadAll = () => {
    const sections = summaries.map(({ doc, result }) => ({ title: doc.name, result }));
    downloadAllSummariesAsPdf(
      sections,
      combinedResult && showCombined ? "Combined Summary" : undefined,
      combinedResult && showCombined ? combinedResult : null
    );
  };

  const loadSample = () => {
    setText(SAMPLE_TEXT);
    setSummaries([]);
    setCombinedResult(null);
    setError("");
  };

  const clearAll = () => {
    setText("");
    setDocs([]);
    setSummaries([]);
    setCombinedResult(null);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-black dark:via-slate-950 dark:to-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Decorative blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-slate-300/30 dark:bg-slate-700/20 blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] rounded-full bg-slate-400/20 dark:bg-slate-600/15 blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 w-[450px] h-[450px] rounded-full bg-slate-300/25 dark:bg-slate-700/15 blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-black/80 border-b border-slate-200/70 dark:border-slate-800/70 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center shadow-lg shadow-slate-500/20">
              <svg className="w-6 h-6 text-white dark:text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Summarizd
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 -mt-0.5">Smart Document Summarizer</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white animate-pulse" />
              Runs 100% in your browser
            </div>
            <ThemeToggle theme={theme} onChange={changeTheme} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero / Intro */}
        {!summaries.length && (
          <div className="mb-8 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 text-slate-900 dark:text-white">
              Summarize{" "}
              <span className="text-slate-500 dark:text-slate-400">multiple documents</span>{" "}
              at once
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Upload several PDFs, Word docs, PowerPoints, or text files. Each file gets its own heading and summary so you always know exactly what you're reading.
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          {/* INPUT PANEL */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-500/5 dark:shadow-none overflow-hidden flex flex-col transition-colors duration-300">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm">1</span>
                Your Documents
              </h3>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {docs.length > 0 && (
                  <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {docs.length} file{docs.length > 1 ? "s" : ""} • {totalDocWords.toLocaleString()} words
                  </span>
                )}
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`m-5 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                dragOver
                  ? "border-slate-900 dark:border-white bg-slate-100 dark:bg-slate-800"
                  : "border-slate-300 dark:border-slate-600 hover:border-slate-900 dark:hover:border-white hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-slate-700 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.9 5 5 0 019.9-1A5.5 5.5 0 0118 16M9 12l3-3m0 0l3 3m-3-3v9" />
                </svg>
              </div>
              <p className="font-medium text-slate-800 dark:text-slate-100">Drop files here to add</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                click to browse — supports <b className="text-slate-900 dark:text-white">PDF, DOCX, PPTX, TXT, MD</b>
              </p>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </div>

            {/* Document list */}
            {docs.length > 0 && (
              <div className="mx-5 mb-4 space-y-2">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 group transition-colors duration-300"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <DocIcon type={doc.type} />
                      <span className="text-sm truncate text-slate-800 dark:text-slate-200" title={doc.name}>
                        {doc.name}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {doc.words.toLocaleString()} words
                      </span>
                    </div>
                    <button
                      onClick={() => removeDoc(doc.id)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                      aria-label="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 my-2">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span>{hasContent ? "add optional notes" : "or paste text"}</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>

            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSummaries([]);
                setCombinedResult(null);
              }}
              placeholder="Optional: paste extra text or notes to include in the combined summary…"
              className="flex-1 mx-5 mb-4 min-h-[160px] resize-none p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:border-slate-900 dark:focus:border-white focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 outline-none text-sm leading-relaxed font-mono text-slate-700 dark:text-slate-300 transition-colors duration-300"
            />

            {/* Controls */}
            <div className="px-5 pb-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Summary length
                  </label>
                  <span className="text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 px-2 py-0.5 rounded-md">
                    {Math.round(ratio * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={50}
                  step={5}
                  value={Math.round(ratio * 100)}
                  onChange={(e) => setRatio(Number(e.target.value) / 100)}
                  className="w-full accent-slate-900 dark:accent-white"
                />
                <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  <span>Concise</span>
                  <span>Balanced</span>
                  <span>Detailed</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSummarize}
                  disabled={loading || !hasContent}
                  className="flex-1 min-w-[160px] px-5 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold shadow-lg shadow-slate-500/25 hover:shadow-xl hover:shadow-slate-500/30 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                        <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Processing…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Summarize Documents
                    </>
                  )}
                </button>
                {!hasContent && (
                  <button
                    onClick={loadSample}
                    className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm transition"
                  >
                    Try sample
                  </button>
                )}
                {hasContent && (
                  <button
                    onClick={clearAll}
                    className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm transition"
                  >
                    Clear
                  </button>
                )}
              </div>

              {error && (
                <div className="text-sm text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </div>
          </section>

          {/* OUTPUT PANEL */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-500/5 dark:shadow-none overflow-hidden flex flex-col transition-colors duration-300">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm">2</span>
                Summaries
              </h3>
              {summaries.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={copyAll}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition flex items-center gap-1.5"
                    title="Copy all summaries"
                  >
                    {copied ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-slate-900 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    onClick={downloadAll}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium shadow-md transition flex items-center gap-1.5"
                    title="Open all summaries in a print-ready page — choose Save as PDF"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Save as PDF
                  </button>
                </div>
              )}
            </div>

            {!summaries.length ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 text-slate-400 dark:text-slate-500">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <p className="font-medium text-slate-600 dark:text-slate-300">Your summaries will appear here</p>
                <p className="text-sm mt-1 max-w-xs">
                  Upload files and click <b className="text-slate-900 dark:text-white">Summarize Documents</b> to get a separate summary per document.
                </p>
              </div>
            ) : (
              <>
                {/* View tabs */}
                <div className="px-5 pt-4">
                  <div className="inline-flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 text-sm border border-slate-200 dark:border-slate-700">
                    <TabBtn active={view === "summary"} onClick={() => setView("summary")}>
                      Summary
                    </TabBtn>
                    <TabBtn active={view === "bullets"} onClick={() => setView("bullets")}>
                      Key Points
                    </TabBtn>
                    <TabBtn active={view === "highlight"} onClick={() => setView("highlight")}>
                      Highlighted
                    </TabBtn>
                    <TabBtn active={view === "keywords"} onClick={() => setView("keywords")}>
                      Keywords
                    </TabBtn>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 px-5 py-4 overflow-auto max-h-[700px] space-y-5">
                  {summaries.map(({ doc, result }) => (
                    <SummaryCard key={doc.id} title={doc.name} type={doc.type} result={result} view={view} />
                  ))}

                  {combinedResult && (
                    <div className="pt-2">
                      <button
                        onClick={() => setShowCombined((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm hover:shadow-md transition"
                      >
                        <span>Combined Summary ({summaries.length} document{summaries.length > 1 ? "s" : ""})</span>
                        <svg
                          className={`w-4 h-4 transition-transform ${showCombined ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showCombined && (
                        <div className="mt-3">
                          <SummaryCard title="Combined Summary" type="combined" result={combinedResult} view={view} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        {/* Features strip */}
        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          <Feature
            icon="⚡"
            title="Instant results"
            desc="Pure client-side TextRank algorithm — no servers, no waiting."
          />
          <Feature
            icon="🔒"
            title="Fully private"
            desc="Your documents never leave your browser. Zero uploads."
          />
          <Feature
            icon="🎯"
            title="Per-document clarity"
            desc="Each file gets its own heading and summary so you never mix things up."
          />
        </div>

        <footer className="mt-12 text-center text-xs text-slate-400 dark:text-slate-500">
          Built with React + Tailwind • Supports PDF, DOCX, PPTX, TXT, MD
        </footer>
      </main>
    </div>
  );
}

function SummaryCard({
  title,
  type,
  result,
  view,
}: {
  title: string;
  type: string;
  result: SummaryResult;
  view: View;
}) {
  const downloadCard = () => {
    downloadSummaryAsPdf(title, result);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md shadow-slate-500/5 dark:shadow-none overflow-hidden transition-colors duration-300 hover:border-slate-400 dark:hover:border-slate-500">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between gap-3">
        <h4 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 min-w-0">
          <DocIcon type={type} />
          <span className="truncate" title={title}>{title}</span>
        </h4>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={downloadCard}
            className="p-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-500 transition shadow-sm"
            title="Open this summary in a print-ready page — choose Save as PDF"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex gap-2">
            <span>{result.stats.summaryWords} words</span>
            <span>{result.stats.compression}% smaller</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        {view === "summary" && (
          <p className="text-[15px] leading-7 text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
            {result.summary}
          </p>
        )}

        {view === "bullets" && (
          <ul className="space-y-2">
            {result.bullets.map((b, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-[15px] leading-6 text-slate-800 dark:text-slate-200">{b}</span>
              </li>
            ))}
          </ul>
        )}

        {view === "highlight" && (
          <div className="text-[15px] leading-7 text-slate-700 dark:text-slate-400">
            {result.sentences.map((s, i) => (
              <span
                key={i}
                className={
                  s.selected
                    ? "bg-slate-300/70 dark:bg-slate-600/50 text-slate-900 dark:text-slate-100 px-0.5 rounded transition"
                    : "text-slate-400 dark:text-slate-600"
                }
              >
                {s.text}{" "}
              </span>
            ))}
          </div>
        )}

        {view === "keywords" && (
          <div className="flex flex-wrap gap-2">
            {result.keywords.map((k) => {
              const size = Math.min(1.5, 0.85 + k.count * 0.06);
              return (
                <span
                  key={k.word}
                  style={{ fontSize: `${size}rem` }}
                  className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium"
                >
                  {k.word}
                  <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">×{k.count}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const icons: Record<Theme, React.ReactNode> = {
    light: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    dark: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
    system: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  };

  const labels: Record<Theme, string> = {
    light: "Light",
    dark: "Dark",
    system: "System",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium transition border border-slate-200 dark:border-slate-700"
        aria-label="Theme"
      >
        {icons[theme]}
        <span className="hidden sm:inline">{labels[theme]}</span>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1 z-30">
          {( ["light", "dark", "system"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition ${
                theme === t
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {icons[t]}
              {labels[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DocIcon({ type }: { type: string }) {
  if (type === "pdf")
    return (
      <span className="w-7 h-7 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">PDF</span>
    );
  if (type === "pptx")
    return (
      <span className="w-7 h-7 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">PPT</span>
    );
  if (type === "docx")
    return (
      <span className="w-7 h-7 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">DOC</span>
    );
  if (type === "xlsx")
    return (
      <span className="w-7 h-7 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">XLS</span>
    );
  if (type === "combined")
    return (
      <span className="w-7 h-7 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center text-[10px] font-bold">ALL</span>
    );
  return (
    <span className="w-7 h-7 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">TXT</span>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md font-medium transition ${
        active
          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700"
          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 transition-colors duration-300 hover:shadow-md hover:border-slate-400 dark:hover:border-slate-500">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="font-semibold text-slate-800 dark:text-slate-100">{title}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{desc}</div>
    </div>
  );
}
