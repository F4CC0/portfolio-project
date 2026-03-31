import { useEffect, useMemo, useState } from "react";
import { getApiStatus, resetKnowledgeBase, uploadProfilePdf } from "../lib/api";

export default function AdminPanel() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [statusMessage, setStatusMessage] = useState("Carregando status da base...");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function loadStatus() {
    setLoadingStatus(true);
    setErrorMessage("");

    try {
      const data = await getApiStatus();
      setStatusData(data);

      if (data?.indexado) {
        setStatusMessage("Base pronta para responder.");
      } else {
        setStatusMessage("Nenhum PDF indexado no momento.");
      }
    } catch (error) {
      setStatusData(null);
      setStatusMessage("Não foi possível consultar o status da base.");
      setErrorMessage(error?.message || "Erro ao consultar o status.");
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleUpload() {
    if (!selectedFile || uploading) return;

    setUploading(true);
    setErrorMessage("");
    setStatusMessage("Enviando PDF e indexando base...");

    try {
      const data = await uploadProfilePdf(selectedFile);
      setStatusMessage(
        `PDF indexado com sucesso. ${data.total_chunks} chunks gerados a partir de ${data.arquivo}.`
      );
      setSelectedFile(null);
      await loadStatus();
    } catch (error) {
      setErrorMessage(error?.message || "Falha ao enviar o PDF.");
      setStatusMessage("Não foi possível concluir o upload.");
    } finally {
      setUploading(false);
    }
  }

  async function handleReset() {
    if (resetting) return;

    setResetting(true);
    setErrorMessage("");
    setStatusMessage("Limpando base indexada...");

    try {
      await resetKnowledgeBase();
      setStatusMessage("Base limpa com sucesso.");
      await loadStatus();
    } catch (error) {
      setErrorMessage(error?.message || "Falha ao resetar a base.");
      setStatusMessage("Não foi possível limpar a base.");
    } finally {
      setResetting(false);
    }
  }

  const fileLabel = useMemo(() => {
    if (!selectedFile) return "Nenhum arquivo selecionado";
    return selectedFile.name;
  }, [selectedFile]);

  return (
    <section className="section admin-shell reveal" id="admin">
      <div className="section-header">
        <span className="section-kicker">A</span>
        <h2>Administração da base RAG</h2>
      </div>

      <div className="admin-grid">
        <div className="admin-card">
          <div className="admin-card-top">
            <h3>Status da API</h3>
            <button className="ghost-button" onClick={loadStatus} disabled={loadingStatus}>
              {loadingStatus ? "Atualizando..." : "Atualizar"}
            </button>
          </div>

          <p className="admin-text">{statusMessage}</p>

          {errorMessage && <p className="admin-error">{errorMessage}</p>}

          <div className="status-list">
            <div className="status-row">
              <span className="status-label">Indexado</span>
              <span className={`status-chip ${statusData?.indexado ? "ok" : "warn"}`}>
                {statusData?.indexado ? "Sim" : "Não"}
              </span>
            </div>

            <div className="status-row">
              <span className="status-label">Arquivo atual</span>
              <span className="status-value">
                {statusData?.pdf_carregado || "Nenhum arquivo"}
              </span>
            </div>

            <div className="status-row">
              <span className="status-label">Total de chunks</span>
              <span className="status-value">
                {typeof statusData?.total_chunks === "number" ? statusData.total_chunks : "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-top">
            <h3>Upload de PDF</h3>
          </div>

          <p className="admin-text">
            Envie um novo PDF com as informações do portfólio para atualizar a base de conhecimento.
          </p>

          <label className="file-picker">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
            <span>Escolher PDF</span>
          </label>

          <p className="selected-file">{fileLabel}</p>

          <div className="admin-actions">
            <button
              className="primary-button"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? "Enviando..." : "Enviar e indexar"}
            </button>

            <button className="danger-button" onClick={handleReset} disabled={resetting}>
              {resetting ? "Limpando..." : "Resetar base"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}