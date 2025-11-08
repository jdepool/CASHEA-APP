import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, TrendingUp, FileText, DollarSign, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sqlQuery?: string;
  data?: any;
}

interface QuickAction {
  id: string;
  label: string;
  query: string;
  icon: React.ElementType;
}

const quickActions: QuickAction[] = [
  {
    id: 'monthly-report',
    label: 'Generar reporte mensual',
    query: '¿Puedes mostrarme un resumen del reporte mensual con todas las métricas principales?',
    icon: FileText,
  },
  {
    id: 'payment-trends',
    label: 'Tendencias de pago',
    query: '¿Cuántos pagos se han verificado este mes?',
    icon: TrendingUp,
  },
  {
    id: 'bank-reconciliation',
    label: 'Conciliación bancaria',
    query: '¿Cuántos depósitos en el banco aún no están conciliados?',
    icon: DollarSign,
  },
];

export function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await apiRequest('POST', '/api/ai/chat', {
        message,
        conversationHistory,
      });
      
      return response.json();
    },
    onSuccess: (response: any) => {
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        sqlQuery: response.sqlQuery,
        data: response.data,
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al procesar tu consulta",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!inputValue.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(inputValue);
    setInputValue("");
  };

  const handleQuickAction = (query: string) => {
    setInputValue(query);
    setTimeout(() => handleSendMessage(), 100);
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center gap-3 pb-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Asistente AI</h2>
          <p className="text-muted-foreground">
            Pregunta sobre tus datos de órdenes, pagos, cuotas y conciliación bancaria
          </p>
        </div>
      </div>

      {messages.length === 0 && (
        <Card className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">¡Hola! Soy tu asistente de datos</h3>
            <p className="text-muted-foreground">
              Puedo ayudarte a consultar y analizar tus datos financieros. Prueba una de estas acciones rápidas:
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            {quickActions.map(action => (
              <Button
                key={action.id}
                variant="outline"
                className="h-auto flex-col items-start p-4 space-y-2"
                onClick={() => handleQuickAction(action.query)}
                data-testid={`quick-action-${action.id}`}
              >
                <action.icon className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{action.label}</span>
              </Button>
            ))}
          </div>
        </Card>
      )}

      {messages.length > 0 && (
        <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                data-testid={`message-${message.role}-${index}`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                )}
                
                <Card className={`p-4 max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : ''}`}>
                  <div className="space-y-2">
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    
                    {message.sqlQuery && (
                      <div className="mt-3 p-3 bg-muted rounded text-xs font-mono overflow-x-auto">
                        <div className="text-muted-foreground mb-1">SQL Query:</div>
                        {message.sqlQuery}
                      </div>
                    )}
                    
                    {message.data && !message.data.error && (
                      <div className="mt-3 p-3 bg-muted rounded text-xs">
                        <div className="text-muted-foreground mb-1">
                          Resultados: {Array.isArray(message.data) ? message.data.length : 0} registros
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {message.role === 'user' && (
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Pensando...</span>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      <div className="flex gap-2 pt-4 border-t">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Escribe tu pregunta aquí... (ej: ¿Cuántas órdenes tengo este mes?)"
          disabled={chatMutation.isPending}
          data-testid="input-ai-query"
          className="flex-1"
        />
        <Button
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || chatMutation.isPending}
          data-testid="button-send-message"
        >
          {chatMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
