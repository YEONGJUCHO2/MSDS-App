import { LoaderCircle, Upload } from "lucide-react";
import { DragEvent, useState } from "react";
import { api, type UploadBatchResult } from "../api/client";
import { MAX_UPLOAD_FILES_PER_BATCH } from "../../shared/uploadLimits";

export function UploadPage({ onUploaded }: { onUploaded: () => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadBatchResult[]>([]);

  async function handleFiles(fileList: FileList | File[] | null | undefined) {
    const files = Array.from(fileList ?? []).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (files.length === 0) return;
    if (files.length > MAX_UPLOAD_FILES_PER_BATCH) {
      setMessage(`한 번에 최대 ${MAX_UPLOAD_FILES_PER_BATCH}개까지만 업로드할 수 있습니다. ${MAX_UPLOAD_FILES_PER_BATCH}개씩 나눠 올려주세요.`);
      setUploadResults([]);
      return;
    }
    setPendingFiles(files);
    setBusy(true);
    setMessage("");
    setUploadResults([]);
    try {
      const result = await api.uploadBatch(files);
      const completed = result.results.filter((item) => item.success);
      const failed = result.results.filter((item) => !item.success);
      setUploadResults(result.results);
      completed.forEach(() => onUploaded());
      setMessage(formatUploadMessage(completed.length, failed.length));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "업로드 실패");
    } finally {
      setBusy(false);
      setPendingFiles([]);
    }
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (!busy) setIsDragging(true);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (!busy) void handleFiles(event.dataTransfer.files);
  }

  return (
    <main className="upload-page">
      <label
        className={`dropzone${isDragging ? " drag-active" : ""}`}
        data-testid="msds-dropzone"
        onDragLeave={() => setIsDragging(false)}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Upload aria-hidden="true" />
        <strong>{busy ? "업로드 처리중" : "MSDS PDF 업로드"}</strong>
        <span>PDF 파일을 선택하거나 이 영역에 끌어다 놓으세요.</span>
        <input
          data-testid="msds-file-input"
          disabled={busy}
          type="file"
          accept="application/pdf"
          multiple
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </label>
      {busy ? (
        <section aria-live="polite" className="upload-progress-panel">
          <div className="upload-progress-title">
            <LoaderCircle aria-hidden="true" className="upload-spinner" />
            <div>
              <strong>업로드 중 {pendingFiles.length}/{MAX_UPLOAD_FILES_PER_BATCH}</strong>
              <span>파일을 분석하고 목록에 반영하는 중입니다.</span>
            </div>
          </div>
          <div aria-label="MSDS 업로드 진행 중" className="upload-progress-bar" role="progressbar">
            <span />
          </div>
          <ul className="upload-pending-list">
            {pendingFiles.map((file) => (
              <li key={`${file.name}-${file.size}`}>
                <span>{file.name}</span>
                <em>대기 중</em>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {message ? <p className="notice">{message}</p> : null}
      {uploadResults.length > 0 ? (
        <ul className="upload-results">
          {uploadResults.map((result) => (
            <li key={result.fileName}>
              {result.success ? result.fileName : `${result.fileName}: ${result.error}`}
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}

function formatUploadMessage(completedCount: number, failedCount: number) {
  if (failedCount === 0) return `${completedCount}개 파일 업로드 완료`;
  if (completedCount === 0) return `${failedCount}개 파일 실패`;
  return `${completedCount}개 파일 업로드 완료, ${failedCount}개 파일 실패`;
}
