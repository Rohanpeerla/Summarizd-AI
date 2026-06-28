// Extractive summarizer using a hybrid TextRank + TF-IDF + position approach.
// All in-browser, no external API calls.

const STOPWORDS = new Set([
  "a","about","above","after","again","against","all","am","an","and","any","are","aren't","as","at",
  "be","because","been","before","being","below","between","both","but","by","can't","cannot","could",
  "couldn't","did","didn't","do","does","doesn't","doing","don't","down","during","each","few","for",
  "from","further","had","hadn't","has","hasn't","have","haven't","having","he","he'd","he'll","he's",
  "her","here","here's","hers","herself","him","himself","his","how","how's","i","i'd","i'll","i'm",
  "i've","if","in","into","is","isn't","it","it's","its","itself","let's","me","more","most","mustn't",
  "my","myself","no","nor","not","of","off","on","once","only","or","other","ought","our","ours",
  "ourselves","out","over","own","same","shan't","she","she'd","she'll","she's","should","shouldn't",
  "so","some","such","than","that","that's","the","their","theirs","them","themselves","then","there",
  "there's","these","they","they'd","they'll","they're","they've","this","those","through","to","too",
  "under","until","up","very","was","wasn't","we","we'd","we'll","we're","we've","were","weren't",
  "what","what's","when","when's","where","where's","which","while","who","who's","whom","why","why's",
  "with","won't","would","wouldn't","you","you'd","you'll","you're","you've","your","yours","yourself",
  "yourselves","also","just","like","much","many","one","two","get","got","make","made","may","might",
  "shall","will","upon","within","without","across","among","around","along","behind"
]);

export interface Sentence {
  text: string;
  index: number;
  score: number;
  selected: boolean;
  words: string[];
}

export interface SummaryResult {
  summary: string;
  bullets: string[];
  sentences: Sentence[];
  keywords: { word: string; count: number }[];
  stats: {
    originalWords: number;
    originalSentences: number;
    summaryWords: number;
    summarySentences: number;
    compression: number;
    readingTimeOriginal: number;
    readingTimeSummary: number;
  };
}

function splitIntoSentences(text: string): string[] {
  // Clean text
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, " ¶ ")
    .replace(/\s+/g, " ")
    .trim();

  // Smart sentence split: handle abbreviations roughly
  const protected_ = cleaned
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|i\.e|e\.g|Inc|Ltd|Co|Corp|U\.S|U\.K|No)\./gi, "$1<DOT>")
    .replace(/(\d)\.(\d)/g, "$1<DOT>$2");

  const parts = protected_.split(/(?<=[.!?])\s+(?=[A-Z0-9"“'(])/g);

  return parts
    .map((s) => s.replace(/<DOT>/g, ".").trim())
    .filter((s) => s.length > 0 && /[a-zA-Z0-9]/.test(s));
}

function tokenize(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  setA.forEach((w) => {
    if (setB.has(w)) intersection++;
  });
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function textRank(sentences: Sentence[], iterations = 30, damping = 0.85): number[] {
  const n = sentences.length;
  if (n === 0) return [];
  if (n === 1) return [1];

  // Build similarity matrix
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = jaccardSimilarity(sentences[i].words, sentences[j].words);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }

  // Row sums
  const rowSums = matrix.map((row) => row.reduce((s, v) => s + v, 0));

  let scores = new Array(n).fill(1 / n);
  for (let iter = 0; iter < iterations; iter++) {
    const newScores = new Array(n).fill((1 - damping) / n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j || rowSums[j] === 0) continue;
        newScores[i] += damping * (matrix[j][i] / rowSums[j]) * scores[j];
      }
    }
    scores = newScores;
  }
  return scores;
}

export function summarize(text: string, ratio = 0.3, minSentences = 3, maxSentences = 20): SummaryResult {
  const rawSentences = splitIntoSentences(text);
  const sentences: Sentence[] = rawSentences.map((s, i) => ({
    text: s,
    index: i,
    score: 0,
    selected: false,
    words: tokenize(s),
  }));

  const total = sentences.length;
  const originalWords = text.trim().split(/\s+/).filter(Boolean).length;

  if (total === 0) {
    return {
      summary: "",
      bullets: [],
      sentences: [],
      keywords: [],
      stats: {
        originalWords,
        originalSentences: 0,
        summaryWords: 0,
        summarySentences: 0,
        compression: 0,
        readingTimeOriginal: 0,
        readingTimeSummary: 0,
      },
    };
  }

  // Word frequency map (for TF scoring)
  const wordFreq = new Map<string, number>();
  sentences.forEach((s) => {
    s.words.forEach((w) => wordFreq.set(w, (wordFreq.get(w) || 0) + 1));
  });
  const maxFreq = Math.max(1, ...Array.from(wordFreq.values()));

  // TextRank scores
  const trScores = textRank(sentences);

  // Combine: textrank + freq + position + length normalization
  sentences.forEach((s, i) => {
    const freqScore =
      s.words.length === 0
        ? 0
        : s.words.reduce((sum, w) => sum + (wordFreq.get(w) || 0) / maxFreq, 0) / s.words.length;

    // Position bias: earlier sentences (especially first) often matter more
    const positionScore = i === 0 ? 1.2 : i < total * 0.2 ? 1.0 : i > total * 0.85 ? 0.85 : 0.7;

    // Length penalty for too-short / too-long sentences
    const wc = s.text.split(/\s+/).length;
    const lengthScore = wc < 5 ? 0.3 : wc > 45 ? 0.7 : 1.0;

    s.score =
      (trScores[i] * 0.55 + freqScore * 0.45) * positionScore * lengthScore;
  });

  // Pick top-N
  const targetCount = Math.min(
    maxSentences,
    Math.max(minSentences, Math.round(total * ratio))
  );
  const selectedIdx = new Set(
    [...sentences]
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(targetCount, total))
      .map((s) => s.index)
  );

  sentences.forEach((s) => (s.selected = selectedIdx.has(s.index)));

  const summarySentences = sentences.filter((s) => s.selected);
  const summary = summarySentences.map((s) => s.text).join(" ");
  const bullets = summarySentences.map((s) => s.text);

  const keywords = Array.from(wordFreq.entries())
    .filter(([w]) => w.length > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));

  const summaryWords = summary.split(/\s+/).filter(Boolean).length;
  return {
    summary,
    bullets,
    sentences,
    keywords,
    stats: {
      originalWords,
      originalSentences: total,
      summaryWords,
      summarySentences: summarySentences.length,
      compression:
        originalWords === 0 ? 0 : Math.round((1 - summaryWords / originalWords) * 100),
      readingTimeOriginal: Math.max(1, Math.round(originalWords / 220)),
      readingTimeSummary: Math.max(1, Math.round(summaryWords / 220)),
    },
  };
}
