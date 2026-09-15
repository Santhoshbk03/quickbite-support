/**
 * A small keyword retriever over the policy documents, used by the mock API to pick which policy
 * answers a question, or to decline when none does.
 *
 * Each chunk is scored by how much of the question it covers, with terms weighted by rarity: words
 * found in few chunks ("allergy", "upi") or in none count most, and words common across the knowledge
 * base ("delivery", "refund") count for half. A question can't match on common words alone, and words
 * no policy mentions pull it towards a refusal.
 */
import type { FixtureDocument } from "@/lib/fixtures/documents";

export interface RetrievedChunk {
  document: FixtureDocument;
  chunkIndex: number;
}

interface IndexedChunk extends RetrievedChunk {
  terms: string[];
  titleTerms: string[];
}

const MIN_COVERAGE = 0.6;
const MAX_RESULTS = 3;

/** Words no policy mentions weigh like rare ones, so off-topic questions fall below the bar. */
const UNKNOWN_TERM_WEIGHT = 1.5;

/* Question filler, plus words too common in this domain to tell policies apart ("order"). */
const STOPWORDS = new Set(
  `a able about after allowed am an and any anything are as at available be been before but by can
  cant could couldn cover covers did didn do does doesn doing don for from get gets getting got had
  has have hello hey hi how i if in into is isn it its just know like me much my need of ok okay on
  one or order orders our per please policy policies possible quickbite say says should so some
  still tell than thanks that the their them then there these this those three to two us use using
  want was wasn we what whats when where which who why will with won wont work works would you
  your`.split(/\s+/),
);

function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? []).map(stem);
}

/** Exact, or sharing a long common prefix: "deliver" matches "delivery", "allergy" matches "allergen". */
function termsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter < 4) return false;
  let prefix = 0;
  while (prefix < shorter && a[prefix] === b[prefix]) prefix += 1;
  return prefix >= Math.max(4, Math.ceil(shorter * 0.8));
}

function queryTerms(message: string): string[] {
  const words = (message.toLowerCase().match(/[a-z]+/g) ?? []).filter(
    (word) => word.length > 1 && !STOPWORDS.has(word),
  );
  return [...new Set(words.map(stem))];
}

export function createRetriever(
  documents: readonly FixtureDocument[],
): (question: string) => RetrievedChunk[] {
  const index: IndexedChunk[] = documents.flatMap((document) =>
    document.chunks.map((chunk, chunkIndex) => ({
      document,
      chunkIndex,
      terms: [...new Set([...chunk.keywords.flatMap(tokens), ...tokens(chunk.section)])],
      titleTerms: [...new Set(tokens(document.title))],
    })),
  );

  const chunkHas = (chunk: IndexedChunk, term: string) =>
    chunk.terms.some((candidate) => termsMatch(term, candidate)) ||
    chunk.titleTerms.some((candidate) => termsMatch(term, candidate));

  return (question) => {
    const terms = queryTerms(question);
    if (terms.length === 0) return [];

    const weights = terms.map((term) => {
      const frequency = index.filter((chunk) => chunkHas(chunk, term)).length;
      if (frequency === 0) return UNKNOWN_TERM_WEIGHT;
      if (frequency <= 3) return 1.5;
      return frequency > index.length * 0.12 ? 0.5 : 1;
    });
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const required = Math.min(totalWeight, terms.length >= 3 ? 1.5 : 1);

    const scored = index
      .flatMap((chunk) => {
        let matched = 0;
        let inTitle = 0;
        terms.forEach((term, position) => {
          if (chunkHas(chunk, term)) matched += weights[position] ?? 1;
          if (chunk.titleTerms.some((candidate) => termsMatch(term, candidate))) inTitle += 1;
        });
        const coverage = matched / totalWeight;
        if (matched < required || coverage < MIN_COVERAGE) return [];
        return [{ chunk, score: coverage + 0.08 * inTitle }];
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0]?.score ?? 0;
    return scored
      .filter((hit) => hit.score >= best - 0.2)
      .slice(0, MAX_RESULTS)
      .map(({ chunk }) => ({ document: chunk.document, chunkIndex: chunk.chunkIndex }));
  };
}
