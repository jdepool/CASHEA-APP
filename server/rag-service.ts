import { db } from './db';
import { embeddings } from '@shared/schema';
import { generateEmbedding, findSimilarContent } from './embedding-service';

export async function retrieveRelevantContext(
  query: string,
  topK: number = 5
): Promise<string> {
  const queryEmbedding = await generateEmbedding(query);
  
  const allEmbeddings = await db.select().from(embeddings);
  
  const similarDocs = await findSimilarContent(
    queryEmbedding,
    allEmbeddings.map(e => ({
      content: e.content,
      embedding: e.embedding,
      metadata: e.metadata,
    })),
    topK
  );

  const context = similarDocs
    .filter(doc => doc.similarity > 0.5)
    .map((doc, index) => {
      const section = doc.metadata?.section || 'general';
      const category = doc.metadata?.category || 'info';
      return `[Documento ${index + 1}] (${section}/${category}, relevancia: ${(doc.similarity * 100).toFixed(1)}%)\n${doc.content}`;
    })
    .join('\n\n---\n\n');

  return context;
}
