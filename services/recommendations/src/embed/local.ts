import { EMBEDDING_DIMS } from '../types.js';

type Pipeline = (
  texts: string | string[],
  opts?: { pooling?: string; normalize?: boolean },
) => Promise<{ data: Float32Array | number[] }>;

let embedderPromise: Promise<Pipeline> | null = null;

async function getEmbedder(): Promise<Pipeline> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      // Free, local, no API key — MiniLM 384-d
      return (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')) as Pipeline;
    })();
  }
  return embedderPromise;
}

function toArray(data: Float32Array | number[]): number[] {
  const values = Array.from(data);
  if (values.length === EMBEDDING_DIMS) return values;
  if (values.length > EMBEDDING_DIMS) return values.slice(0, EMBEDDING_DIMS);
  return [...values, ...new Array(EMBEDDING_DIMS - values.length).fill(0)];
}

/** Free local embeddings — no Gemini / no billing. */
export async function embedText(text: string): Promise<number[]> {
  const extract = await getEmbedder();
  const output = await extract(text.slice(0, 8000), {
    pooling: 'mean',
    normalize: true,
  });
  return toArray(output.data);
}

export async function embedTexts(
  texts: string[],
  _opts: { concurrency?: number; gapMs?: number } = {},
): Promise<number[][]> {
  const extract = await getEmbedder();
  const out: number[][] = [];
  // Sequential — model is local CPU; batching via pipeline still one-at-a-time is safest
  for (const text of texts) {
    const output = await extract(text.slice(0, 8000), {
      pooling: 'mean',
      normalize: true,
    });
    out.push(toArray(output.data));
  }
  return out;
}
