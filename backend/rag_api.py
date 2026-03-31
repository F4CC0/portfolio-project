"""
RAG API — baseado na Atividade 4 da disciplina de IA
Transforme seu notebook em um serviço FastAPI completo.

Como rodar:
    pip install fastapi uvicorn python-multipart docling rank-bm25 \
                sentence-transformers faiss-cpu openai
   
    export LLM_API_KEY="m71D5aqDATPQt_GV_3nmdO8nK8wB4Vb5PzV-d4bRGYc"
    uvicorn rag_api:app --reload
"""

import os
import re
import tempfile
import numpy as np
import faiss

from pathlib import Path
from typing import Literal
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, model_validator

from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer
from openai import OpenAI


class RAGState:
    chunks: list[dict] = []
    indice_bm25: BM25Okapi | None = None
    indice_faiss: faiss.Index | None = None
    matriz_emb: np.ndarray | None = None
    modelo_embed: SentenceTransformer | None = None
    pdf_nome: str = ""


state = RAGState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Carregando modelo de embeddings...")
    state.modelo_embed = SentenceTransformer(
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )
    print("Modelo pronto!")
    yield
    print("Encerrando API.")


app = FastAPI(
    title="RAG API",
    description="API RAG para upload de PDF e perguntas sobre o conteúdo.",
    version="1.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://llm.liaufms.org/v1/gemma-3-12b-it")
LLM_API_KEY = os.getenv("LLM_API_KEY", "coloque_sua_chave_aqui")
LLM_MODEL = os.getenv("LLM_MODEL", "google/gemma-3-12b-it")

LLM_CLIENT = OpenAI(
    base_url=LLM_BASE_URL,
    api_key=LLM_API_KEY,
)


def tokenizar(texto: str) -> list[str]:
    return re.findall(r"\w+", texto.lower())


def chunking_fixo(texto: str, tamanho: int = 500) -> list[str]:
    return [texto[i:i + tamanho] for i in range(0, len(texto), tamanho)]


def chunking_janela(texto: str, tamanho: int = 500, sobreposicao: int = 100) -> list[str]:
    if sobreposicao >= tamanho:
        raise ValueError("sobreposicao deve ser menor que tamanho")
    passo = tamanho - sobreposicao
    return [texto[i:i + tamanho] for i in range(0, len(texto), passo)]


def chunking_paragrafo(texto: str, min_chars: int = 100) -> list[str]:
    paragrafos = [p.strip() for p in texto.split("\n\n")]
    return [p for p in paragrafos if len(p) >= min_chars]


def aplicar_chunking(
    texto: str,
    estrategia: str = "paragrafo",
    tamanho: int = 500,
    sobreposicao: int = 100,
) -> list[dict]:
    if estrategia == "fixo":
        brutos = chunking_fixo(texto, tamanho)
    elif estrategia == "janela":
        brutos = chunking_janela(texto, tamanho, sobreposicao)
    else:
        brutos = chunking_paragrafo(texto)

    filtrados = [c.strip() for c in brutos if c.strip()]
    return [{"id": f"chunk_{i:04d}", "texto": t} for i, t in enumerate(filtrados)]


def indexar(chunks: list[dict]) -> None:
    corpus = [tokenizar(c["texto"]) for c in chunks]
    state.indice_bm25 = BM25Okapi(corpus)

    textos = [c["texto"] for c in chunks]
    state.matriz_emb = state.modelo_embed.encode(
        textos,
        normalize_embeddings=True,
        show_progress_bar=False,
    ).astype("float32")

    dim = state.matriz_emb.shape[1]
    state.indice_faiss = faiss.IndexFlatIP(dim)
    state.indice_faiss.add(state.matriz_emb)


def normalizar(v: np.ndarray) -> np.ndarray:
    v = np.array(v, dtype="float32")
    delta = float(v.max() - v.min())
    return np.zeros_like(v) if delta < 1e-9 else (v - v.min()) / delta


def recuperar_bm25(pergunta: str, k: int = 3) -> list[dict]:
    scores = state.indice_bm25.get_scores(tokenizar(pergunta))
    idx = np.argsort(scores)[::-1][:k]
    return [
        {
            "id": state.chunks[i]["id"],
            "texto": state.chunks[i]["texto"],
            "score": float(scores[i]),
        }
        for i in idx
    ]


def recuperar_dense(pergunta: str, k: int = 3) -> list[dict]:
    q = state.modelo_embed.encode([pergunta], normalize_embeddings=True).astype("float32")
    scores, idx = state.indice_faiss.search(q, k)
    return [
        {
            "id": state.chunks[i]["id"],
            "texto": state.chunks[i]["texto"],
            "score": float(scores[0][j]),
        }
        for j, i in enumerate(idx[0])
        if i >= 0
    ]


def recuperar_hibrido(pergunta: str, k: int = 3, alpha: float = 0.6) -> list[dict]:
    sb = normalizar(state.indice_bm25.get_scores(tokenizar(pergunta)))
    q = state.modelo_embed.encode([pergunta], normalize_embeddings=True).astype("float32")
    sd = normalizar(np.dot(state.matriz_emb, q[0]))
    score_final = alpha * sd + (1.0 - alpha) * sb
    idx = np.argsort(score_final)[::-1][:k]
    return [
        {
            "id": state.chunks[i]["id"],
            "texto": state.chunks[i]["texto"],
            "score": float(score_final[i]),
        }
        for i in idx
    ]


def recuperar(pergunta: str, metodo: str = "hibrido", k: int = 3, alpha: float = 0.6) -> list[dict]:
    if metodo == "bm25":
        return recuperar_bm25(pergunta, k)
    if metodo == "dense":
        return recuperar_dense(pergunta, k)
    return recuperar_hibrido(pergunta, k, alpha)


def construir_prompt(pergunta: str, docs: list[dict]) -> str:
    contexto = "\n\n".join([f"Trecho {i + 1}:\n{d['texto']}" for i, d in enumerate(docs)])
    return (
        "Você é um assistente de portfólio profissional.\n"
        "Responda em português usando apenas as informações do contexto abaixo.\n"
        "Quando houver informação parcial, responda com o que for possível inferir diretamente do contexto, sem inventar.\n"
        "Quando realmente não houver base suficiente, diga claramente: não encontrado no contexto.\n\n"
        f"Contexto:\n{contexto}\n\n"
        f"Pergunta: {pergunta}"
    )


def gerar_resposta(pergunta: str, docs: list[dict]) -> str:
    if LLM_API_KEY == "coloque_sua_chave_aqui":
        raise HTTPException(
            status_code=500,
            detail="LLM_API_KEY não configurada no ambiente.",
        )

    conteudo = construir_prompt(pergunta, docs)
    resp = LLM_CLIENT.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": conteudo}],
    )
    return resp.choices[0].message.content


def verificar_indice():
    if not state.chunks:
        raise HTTPException(
            status_code=400,
            detail="Nenhum PDF indexado. Use POST /upload primeiro.",
        )


class AskRequest(BaseModel):
    pergunta: str | None = None
    question: str | None = None
    metodo: Literal["bm25", "dense", "hibrido"] = "hibrido"
    k: int = 5
    alpha: float = 0.6

    @model_validator(mode="after")
    def validar_pergunta(self):
        texto = (self.pergunta or self.question or "").strip()
        if not texto:
            raise ValueError("Envie 'pergunta' ou 'question'.")
        self.pergunta = texto
        return self


class AskResponse(BaseModel):
    pergunta: str
    resposta: str
    metodo: str
    chunks_usados: list[dict]


class SearchResponse(BaseModel):
    pergunta: str
    metodo: str
    resultados: list[dict]


class StatusResponse(BaseModel):
    pdf_carregado: str
    total_chunks: int
    indexado: bool


@app.get("/", tags=["Geral"])
def raiz():
    return {"mensagem": "RAG API rodando! Acesse /docs para a documentação completa."}


@app.get("/status", response_model=StatusResponse, tags=["Geral"])
def status():
    return StatusResponse(
        pdf_carregado=state.pdf_nome,
        total_chunks=len(state.chunks),
        indexado=state.indice_bm25 is not None,
    )


@app.post("/upload", tags=["Indexação"])
async def upload_pdf(
    arquivo: UploadFile | None = File(default=None),
    file: UploadFile | None = File(default=None),
    estrategia: Literal["fixo", "janela", "paragrafo"] = Query("paragrafo"),
    tamanho_chunk: int = Query(500),
    sobreposicao: int = Query(100),
):
    arquivo_recebido = arquivo or file
    if arquivo_recebido is None:
        raise HTTPException(status_code=400, detail="Envie um arquivo no campo 'arquivo' ou 'file'.")

    nome_arquivo = arquivo_recebido.filename or ""
    if not nome_arquivo.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .pdf")

    conteudo = await arquivo_recebido.read()

    try:
      with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
          tmp.write(conteudo)
          caminho_tmp = Path(tmp.name)

      from docling.document_converter import DocumentConverter

      converter = DocumentConverter()
      resultado = converter.convert(str(caminho_tmp))
      texto_md = resultado.document.export_to_markdown()

    except Exception as e:
      raise HTTPException(status_code=500, detail=f"Erro ao converter PDF: {e}")

    finally:
      if "caminho_tmp" in locals():
          caminho_tmp.unlink(missing_ok=True)

    chunks = aplicar_chunking(texto_md, estrategia, tamanho_chunk, sobreposicao)
    if not chunks:
        raise HTTPException(status_code=400, detail="Nenhum chunk gerado. Verifique o PDF.")

    state.chunks = chunks
    state.pdf_nome = nome_arquivo
    indexar(chunks)

    tamanhos = [len(c["texto"]) for c in chunks]
    return {
        "mensagem": "PDF indexado com sucesso!",
        "arquivo": nome_arquivo,
        "estrategia": estrategia,
        "total_chunks": len(chunks),
        "tamanho_medio": int(np.mean(tamanhos)),
        "tamanho_max": max(tamanhos),
        "tamanho_min": min(tamanhos),
    }


@app.post("/ask", response_model=AskResponse, tags=["RAG"])
def ask(req: AskRequest):
    verificar_indice()

    pergunta = req.pergunta
    docs = recuperar(pergunta, req.metodo, req.k, req.alpha)
    resposta = gerar_resposta(pergunta, docs)

    return AskResponse(
        pergunta=pergunta,
        resposta=resposta,
        metodo=req.metodo,
        chunks_usados=docs,
    )


@app.get("/search", response_model=SearchResponse, tags=["RAG"])
def search(
    q: str = Query(..., description="Pergunta para busca"),
    metodo: Literal["bm25", "dense", "hibrido"] = Query("hibrido"),
    k: int = Query(5, ge=1, le=20),
    alpha: float = Query(0.6, ge=0.0, le=1.0),
):
    verificar_indice()

    resultados = recuperar(q, metodo, k, alpha)
    return SearchResponse(pergunta=q, metodo=metodo, resultados=resultados)


@app.get("/chunks", tags=["Indexação"])
def listar_chunks(
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(10, ge=1, le=100),
):
    verificar_indice()

    inicio = (pagina - 1) * por_pagina
    fim = inicio + por_pagina
    pagina_chunks = state.chunks[inicio:fim]

    return {
        "total": len(state.chunks),
        "pagina": pagina,
        "por_pagina": por_pagina,
        "chunks": pagina_chunks,
    }


@app.get("/chunks/{chunk_id}", tags=["Indexação"])
def obter_chunk(chunk_id: str):
    verificar_indice()

    for c in state.chunks:
        if c["id"] == chunk_id:
            return c

    raise HTTPException(status_code=404, detail=f"Chunk '{chunk_id}' não encontrado.")


@app.delete("/reset", tags=["Indexação"])
def reset():
    state.chunks = []
    state.indice_bm25 = None
    state.indice_faiss = None
    state.matriz_emb = None
    state.pdf_nome = ""
    return {"mensagem": "Índice limpo com sucesso."}


@app.post("/compare", tags=["RAG"])
def comparar_metodos(
    q: str = Query(..., description="Pergunta para comparar"),
    k: int = Query(5, ge=1, le=10),
):
    verificar_indice()

    resultado = {}
    for metodo in ["bm25", "dense", "hibrido"]:
        docs = recuperar(q, metodo, k)
        resposta = gerar_resposta(q, docs)
        resultado[metodo] = {
            "resposta": resposta,
            "chunks": [{"id": d["id"], "score": d["score"]} for d in docs],
        }

    return {"pergunta": q, "comparacao": resultado}