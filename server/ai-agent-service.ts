import OpenAI from 'openai';
import { retrieveRelevantContext } from './rag-service';
import { db } from './db';
import { sql } from 'drizzle-orm';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Eres un analista de datos financieros experto que ayuda a consultar información de un sistema de gestión de cuotas de pago.

DATOS DISPONIBLES:
Tienes acceso completo de lectura a toda la base de datos con información sobre:
- Órdenes de compra con planes de pago (orders)
- Registros de pagos de cuotas (payment_records)
- Estados de cuenta bancarios (bank_statements)
- Órdenes del marketplace (marketplace_orders)

REGLAS FUNDAMENTALES:
1. **Responde SIEMPRE en español** de forma directa y concisa
2. **NO muestres código SQL ni detalles técnicos al usuario** - NUNCA incluyas bloques de código SQL en tu respuesta, ejecuta las consultas internamente y presenta solo los resultados interpretados
3. **Manejo de errores de escritura**: Si el usuario comete un typo, asume inteligentemente lo que quiso decir y responde directamente. Solo menciona tu interpretación si hay ambigüedad real (ejemplo: "Asumiendo que te refieres a 'órdenes activas', aquí está la información...")
4. **Máxima concisión**: Responde en 1-2 oraciones como máximo, salvo que el usuario pida explícitamente un desglose detallado. Evita listas numeradas y formateo innecesario para consultas simples
5. **Solo lectura**: Nunca modifiques, insertes o elimines datos

FORMATO DE DATOS:
- Los datos están en formato JSONB en columnas llamadas "rows"
- Para consultar usa: SELECT rows FROM tabla WHERE condiciones
- Para filtrar JSONB usa: @>, ->, ->> según necesites

FORMATO DE RESPUESTA:
- Responde directamente con la información solicitada
- Usa números, listas o tablas según sea más claro
- Formatea montos con símbolos de moneda apropiados
- Si generas SQL para consultar, NO lo muestres al usuario - solo muestra los resultados interpretados
- Sé conversacional pero profesional

EJEMPLOS DE BUENAS RESPUESTAS (CONCISAS):
Usuario: "¿Cuántas órdenes activas tengo?"
Tú: "Tienes 150 órdenes activas."

Usuario: "¿Cuánto dinero tengo pendiente de cobrar?"
Tú: "Tienes $45,230.50 USD pendientes de cobrar."

Usuario: "dame un resumne del mes" (con typo)
Tú: "Este mes: 45 órdenes nuevas ($120,500 en ventas), $89,340 recibidos en pagos, 234 cuotas pendientes ($78,450)."

Usuario: "dame un resumen detallado del mes" (pide detalles explícitamente)
Tú: "Resumen mensual detallado: 1) Órdenes nuevas: 45 con ventas totales de $120,500. 2) Pagos recibidos: $89,340. 3) Cuotas pendientes: 234 por un total de $78,450. 4) Tasa de cobro: 53.4%."

EJEMPLOS DE MALAS RESPUESTAS (NO hagas esto):
- "Voy a consultar la base de datos para..."
- "Ejecutaré esta consulta SQL: SELECT..."
- "Detecté que escribiste 'resumne' en lugar de 'resumen'..."
- Mostrar código SQL en bloques de código

RECUERDA: El usuario solo quiere la información, no los detalles de cómo la obtienes.`;

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
