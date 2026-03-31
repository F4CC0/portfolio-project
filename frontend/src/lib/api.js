const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function buildError(message, status = null, detail = null, code = "UNKNOWN_ERROR") {
  return {
    message,
    status,
    detail,
    code
  };
}

async function parseErrorResponse(response) {
  let detail = null;

  try {
    const data = await response.json();
    detail = data?.detail || data?.message || null;
  } catch {
    try {
      detail = await response.text();
    } catch {
      detail = null;
    }
  }

  if (response.status === 400) {
    const detailText = String(detail || "").toLowerCase();

    if (detailText.includes("nenhum pdf indexado")) {
      throw buildError(
        "Nenhum PDF foi indexado ainda. Faça upload de um documento primeiro.",
        400,
        detail,
        "PDF_NOT_INDEXED"
      );
    }

    throw buildError(
      "A requisição foi rejeitada pela API.",
      400,
      detail,
      "BAD_REQUEST"
    );
  }

  if (response.status === 404) {
    throw buildError(
      "Endpoint não encontrado. Verifique a URL da API.",
      404,
      detail,
      "NOT_FOUND"
    );
  }

  if (response.status === 500) {
    const detailText = String(detail || "").toLowerCase();

    if (detailText.includes("llm_api_key")) {
      throw buildError(
        "A chave da LLM não está configurada no backend.",
        500,
        detail,
        "LLM_KEY_MISSING"
      );
    }

    if (detailText.includes("converter pdf")) {
      throw buildError(
        "O backend falhou ao processar o PDF enviado.",
        500,
        detail,
        "PDF_CONVERSION_ERROR"
      );
    }

    throw buildError(
      "O backend encontrou um erro interno.",
      500,
      detail,
      "INTERNAL_SERVER_ERROR"
    );
  }

  throw buildError(
    "Ocorreu um erro inesperado ao falar com a API.",
    response.status,
    detail,
    "API_ERROR"
  );
}

async function request(path, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal
    });

    if (!response.ok) {
      await parseErrorResponse(response);
    }

    return response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw buildError(
        "A requisição demorou demais e expirou.",
        null,
        null,
        "TIMEOUT"
      );
    }

    if (error?.code) {
      throw error;
    }

    throw buildError(
      "Não foi possível conectar ao backend. Verifique se a API está rodando.",
      null,
      error?.message || null,
      "BACKEND_OFFLINE"
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function askAboutProfile(question) {
  return request("/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      question,
      metodo: "hibrido",
      k: 5,
      alpha: 0.6
    })
  });
}

export async function getApiStatus() {
  return request("/status", {
    method: "GET"
  });
}

export async function resetKnowledgeBase() {
  return request("/reset", {
    method: "DELETE"
  });
}

export async function uploadProfilePdf(file) {
  const formData = new FormData();
  formData.append("file", file);

  return request(
    "/upload",
    {
      method: "POST",
      body: formData
    },
    120000
  );
}