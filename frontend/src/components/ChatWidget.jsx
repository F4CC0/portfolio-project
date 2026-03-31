import { useEffect, useRef, useState } from "react";
import { askAboutProfile } from "../lib/api";

function getFriendlyErrorMessage(error) {
  if (!error?.code) {
    return "Não consegui concluir a resposta agora.";
  }

  if (error.code === "BACKEND_OFFLINE") {
    return "Não consegui conectar com o backend. Verifique se a API está rodando.";
  }

  if (error.code === "PDF_NOT_INDEXED") {
    return "Ainda não há nenhum PDF indexado. Faça upload de um documento no painel administrativo.";
  }

  if (error.code === "LLM_KEY_MISSING") {
    return "A chave da LLM não está configurada no backend.";
  }

  if (error.code === "TIMEOUT") {
    return "A resposta demorou demais. Tente novamente em instantes.";
  }

  if (error.code === "INTERNAL_SERVER_ERROR") {
    return "O backend encontrou um erro interno ao processar sua pergunta.";
  }

  return error.message || "Ocorreu um erro inesperado.";
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: "Olá! Pode me perguntar sobre o Guilherme, suas habilidades, projetos, pesquisa e experiência."
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [lastErrorCode, setLastErrorCode] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, open]);

  async function handleSend(text) {
    const pergunta = text.trim();
    if (!pergunta || loading) return;

    setMessages((prev) => [...prev, { type: "user", text: pergunta }]);
    setInput("");
    setLoading(true);
    setLastErrorCode(null);

    try {
      const data = await askAboutProfile(pergunta);
      const resposta =
        data?.resposta?.trim() ||
        data?.answer?.trim() ||
        data?.response?.trim() ||
        "";

      if (!resposta) {
        setLastErrorCode("EMPTY_RESPONSE");
        setMessages((prev) => [
          ...prev,
          {
            type: "bot",
            text: "Recebi a resposta da API, mas ela veio vazia."
          }
        ]);
        return;
      }

      setMessages((prev) => [...prev, { type: "bot", text: resposta }]);
    } catch (error) {
      setLastErrorCode(error?.code || "UNKNOWN_ERROR");
      setMessages((prev) => [
        ...prev,
        {
          type: "bot",
          text: getFriendlyErrorMessage(error)
        }
      ]);
      console.error("Erro ao conectar com a API:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="chat-toggle" onClick={() => setOpen((prev) => !prev)}>
        {open ? "Fechar" : "Chat"}
      </button>

      {open && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="chat-header-top">
              <strong>Assistente do Guilherme</strong>
              <button
                className="chat-close"
                onClick={() => setOpen(false)}
                aria-label="Fechar chat"
              >
                ×
              </button>
            </div>
            <div className="chat-subtitle">
              Pergunte sobre habilidades, projetos, pesquisa e experiência.
            </div>
          </div>

          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`msg ${msg.type}`}>
                {msg.text}
              </div>
            ))}

            {loading && <div className="msg bot">Digitando...</div>}

            {!loading && lastErrorCode === "PDF_NOT_INDEXED" && (
              <div className="chat-inline-hint">
                Dica: use o painel administrativo para enviar o PDF da base de conhecimento.
              </div>
            )}

            {!loading && lastErrorCode === "BACKEND_OFFLINE" && (
              <div className="chat-inline-hint">
                Dica: confirme se o backend está rodando em <code>127.0.0.1:8000</code>.
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <input
              type="text"
              value={input}
              placeholder="Pergunte sobre o Guilherme..."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend(input);
              }}
              disabled={loading}
            />
            <button onClick={() => handleSend(input)} disabled={loading || !input.trim()}>
              {loading ? "..." : "Enviar"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}