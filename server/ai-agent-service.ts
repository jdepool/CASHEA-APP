import OpenAI from 'openai';
import { retrieveRelevantContext } from './rag-service';
import { db } from './db';
import { sql } from 'drizzle-orm';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Eres un asistente de IA especializado en análisis de datos financieros para un sistema de gestión de cuotas de pago.

Tu trabajo es ayudar a los usuarios a consultar y analizar sus datos de:
- Órdenes de compra con planes de pago
- Registros de pagos de cuotas
- Estados de cuenta bancarios
- Órdenes del marketplace

REGLAS IMPORTANTES:
1. **Solo puedes leer datos** - NO puedes modificar, insertar o eliminar datos
2. **Responde SIEMPRE en español** de manera clara y profesional
3. Cuando generes SQL, usa SOLO consultas SELECT
4. Los datos están en formato JSONB en columnas llamadas "rows"
5. Para filtrar datos en JSONB, usa operadores como @>, ->, ->>
6. Proporciona explicaciones claras antes de mostrar los resultados
7. Si no estás seguro de algo, pregunta al usuario para aclarar

TABLAS DISPONIBLES:
- orders: Órdenes con cuotas programadas (rows contiene array de objetos con Orden, Cliente, Cuota 1, Fecha Cuota 1, etc.)
- payment_records: Registros de pagos (rows contiene Orden, Cuota Pagada, Referencia, Fecha de Pago, Monto USD, etc.)
- bank_statements: Estado de cuenta bancario (rows contiene Fecha, Referencia, Monto, Descripción, etc.)
- marketplace_orders: Órdenes del marketplace (rows contiene Orden, Estado, Total Venta, PAGO INICIAL, etc.)

FORMATO DE RESPUESTA:
1. Saluda brevemente y confirma que entendiste la consulta
2. Si es necesario generar SQL, explica qué vas a buscar
3. Muestra los resultados de forma clara y organizada
4. Proporciona insights o resúmenes cuando sea relevante
5. Pregunta si necesita más detalles o análisis adicionales`;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  message: string;
  sqlQuery?: string;
  data?: any;
  context?: string;
}

export async function processUserQuery(
  userQuery: string,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResponse> {
  try {
    const relevantContext = await retrieveRelevantContext(userQuery, 5);

    const contextualizedPrompt = `${SYSTEM_PROMPT}

CONTEXTO RELEVANTE DE LA BASE DE CONOCIMIENTO:
${relevantContext}

---

Ahora responde a la consulta del usuario teniendo en cuenta este contexto.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: contextualizedPrompt },
      ...conversationHistory,
      { role: 'user', content: userQuery },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const assistantMessage = completion.choices[0]?.message?.content || 
      'Lo siento, no pude procesar tu consulta.';

    const sqlMatch = assistantMessage.match(/```sql\n([\s\S]*?)\n```/);
    let sqlQuery: string | undefined;
    let data: any;

    if (sqlMatch && sqlMatch[1]) {
      sqlQuery = sqlMatch[1].trim();
      
      if (isReadOnlyQuery(sqlQuery)) {
        try {
          const result = await db.execute(sql.raw(sqlQuery));
          data = result.rows;
        } catch (error) {
          console.error('Error ejecutando SQL:', error);
          data = { error: 'Error al ejecutar la consulta SQL' };
        }
      } else {
        data = { 
          error: 'Consulta rechazada: Solo se permiten consultas de lectura (SELECT)' 
        };
      }
    }

    return {
      message: assistantMessage,
      sqlQuery,
      data,
      context: relevantContext,
    };
  } catch (error) {
    console.error('Error en processUserQuery:', error);
    throw new Error('Error procesando la consulta del usuario');
  }
}

function isReadOnlyQuery(query: string): boolean {
  const normalizedQuery = query.trim().toUpperCase();
  
  const dangerousKeywords = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
    'TRUNCATE', 'REPLACE', 'MERGE', 'GRANT', 'REVOKE',
  ];

  for (const keyword of dangerousKeywords) {
    if (normalizedQuery.includes(keyword)) {
      return false;
    }
  }

  return normalizedQuery.startsWith('SELECT') || 
         normalizedQuery.startsWith('WITH');
}
