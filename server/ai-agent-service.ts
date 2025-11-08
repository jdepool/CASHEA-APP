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

CÓMO CONSULTAR DATOS:
Para responder preguntas sobre los datos, usa la función "query_database" que te permite ejecutar consultas SQL.
- Los datos están en formato JSONB en columnas llamadas "rows"
- Usa: SELECT rows FROM tabla WHERE condiciones
- Para filtrar JSONB usa operadores: @>, ->, ->>
- SIEMPRE usa la función query_database cuando necesites información de la base de datos
- NO inventes datos, SIEMPRE consulta primero

REGLAS FUNDAMENTALES:
1. **Responde SIEMPRE en español** de forma directa y concisa
2. **NO muestres código SQL al usuario** - las consultas se ejecutan internamente
3. **Manejo de typos**: Si el usuario comete un error de escritura, asume lo que quiso decir y responde. Solo menciona tu interpretación si hay ambigüedad real
4. **Máxima concisión**: Responde en 1-2 oraciones, salvo que el usuario pida un desglose detallado
5. **Solo lectura**: Solo consultas SELECT, nunca INSERT/UPDATE/DELETE
6. **Datos reales**: NUNCA inventes números o información. Si necesitas datos, usa query_database

FORMATO DE RESPUESTA:
- Responde directamente con la información consultada
- Formatea montos con símbolos de moneda (USD, $, etc.)
- Sé conversacional pero profesional

EJEMPLOS:
Usuario: "¿Cuántas órdenes activas tengo?"
Tú: [Llamas query_database con SQL] → "Tienes 120 órdenes activas."

Usuario: "dame un resumne del mes" (con typo)
Tú: [Llamas query_database] → "Este mes: 35 órdenes nuevas ($98,450 en ventas), $67,200 recibidos, 189 cuotas pendientes ($45,680)."`;

const QUERY_DATABASE_FUNCTION = {
  name: 'query_database',
  description: 'Ejecuta una consulta SQL de solo lectura (SELECT) contra la base de datos de cuotas de pago. Devuelve los resultados para que puedas interpretarlos y responder al usuario.',
  parameters: {
    type: 'object',
    properties: {
      sql_query: {
        type: 'string',
        description: 'La consulta SQL SELECT a ejecutar. Los datos están en columnas JSONB llamadas "rows". Usa operadores JSONB como @>, ->, ->> para filtrar.',
      },
      reasoning: {
        type: 'string',
        description: 'Breve explicación de qué información buscas con esta consulta (para logging interno, no se muestra al usuario).',
      },
    },
    required: ['sql_query', 'reasoning'],
  },
};

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
${relevantContext}`;

    const messages: any[] = [
      { role: 'system', content: contextualizedPrompt },
      ...conversationHistory,
      { role: 'user', content: userQuery },
    ];

    let sqlQuery: string | undefined;
    let data: any;
    let assistantMessage: string;

    const initialCompletion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      tools: [{ type: 'function', function: QUERY_DATABASE_FUNCTION }],
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 2000,
    });

    const choice = initialCompletion.choices[0];
    
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      
      if (toolCall.type === 'function' && toolCall.function.name === 'query_database') {
        const args = JSON.parse(toolCall.function.arguments);
        sqlQuery = args.sql_query;
        const reasoning = args.reasoning;
        
        console.log('[AI Agent] Query reasoning:', reasoning);
        console.log('[AI Agent] Generated SQL:', sqlQuery || '');

        if (sqlQuery && isReadOnlyQuery(sqlQuery)) {
          try {
            const result = await db.execute(sql.raw(sqlQuery));
            data = result.rows;
            
            messages.push(choice.message);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                success: true,
                rows: data,
                rowCount: data.length,
              }),
            });

            const finalCompletion = await openai.chat.completions.create({
              model: 'gpt-4-turbo-preview',
              messages,
              temperature: 0.3,
              max_tokens: 1000,
            });

            assistantMessage = finalCompletion.choices[0]?.message?.content || 
              'Obtuve los datos pero no pude generar una respuesta.';
              
          } catch (error: any) {
            console.error('[AI Agent] SQL execution error:', error);
            
            messages.push(choice.message);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                success: false,
                error: error.message || 'Error al ejecutar la consulta',
              }),
            });

            const errorCompletion = await openai.chat.completions.create({
              model: 'gpt-4-turbo-preview',
              messages,
              temperature: 0.3,
              max_tokens: 500,
            });

            assistantMessage = errorCompletion.choices[0]?.message?.content || 
              'Lo siento, hubo un error al consultar los datos.';
          }
        } else {
          assistantMessage = 'Lo siento, esa consulta no está permitida. Solo puedo ejecutar consultas de lectura (SELECT).';
        }
      } else {
        assistantMessage = choice.message.content || 'Lo siento, no pude procesar tu consulta.';
      }
    } else {
      assistantMessage = choice.message.content || 'Lo siento, no pude procesar tu consulta.';
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
