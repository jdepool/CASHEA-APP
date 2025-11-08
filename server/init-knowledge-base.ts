import { fileURLToPath } from 'url';
import { db } from './db';
import { embeddings } from '@shared/schema';
import { knowledgeBase } from './knowledge-base';
import { createEmbeddingRecord } from './embedding-service';
import { eq, sql } from 'drizzle-orm';

export async function initializeKnowledgeBase() {
  try {
    console.log('🚀 Inicializando base de conocimiento...');

    const existingCount = await db.select({ count: sql<number>`count(*)` }).from(embeddings);
    
    if (existingCount[0]?.count > 0) {
      console.log(`✅ Base de conocimiento ya inicializada con ${existingCount[0].count} documentos`);
      return;
    }

    console.log(`📚 Generando embeddings para ${knowledgeBase.length} documentos...`);

    for (let i = 0; i < knowledgeBase.length; i++) {
      const item = knowledgeBase[i];
      console.log(`  Procesando ${i + 1}/${knowledgeBase.length}: ${item.section} - ${item.category}`);
      
      const embeddingRecord = await createEmbeddingRecord(item.content, {
        section: item.section,
        category: item.category,
      });

      await db.insert(embeddings).values([embeddingRecord]);
    }

    console.log('✅ Base de conocimiento inicializada exitosamente');
  } catch (error) {
    console.error('❌ Error inicializando base de conocimiento:', error);
    throw error;
  }
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  initializeKnowledgeBase()
    .then(() => {
      console.log('✅ Proceso completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}
