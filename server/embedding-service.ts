import OpenAI from 'openai';
import type { InsertEmbedding } from '@shared/schema';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

export async function createEmbeddingRecord(
  content: string,
  metadata: { section: string; category: string; [key: string]: any }
): Promise<InsertEmbedding> {
  const embedding = await generateEmbedding(content);
  
  return {
    content,
    embedding: JSON.stringify(embedding),
    metadata,
  };
}

export async function cosineSimilarity(a: number[], b: number[]): Promise<number> {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function findSimilarContent(
  queryEmbedding: number[],
  allEmbeddings: Array<{ content: string; embedding: string; metadata: any }>,
  topK: number = 5
): Promise<Array<{ content: string; similarity: number; metadata: any }>> {
  const similarities = await Promise.all(
    allEmbeddings.map(async (item) => {
      const embedding = JSON.parse(item.embedding) as number[];
      const similarity = await cosineSimilarity(queryEmbedding, embedding);
      return {
        content: item.content,
        similarity,
        metadata: item.metadata,
      };
    })
  );

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
