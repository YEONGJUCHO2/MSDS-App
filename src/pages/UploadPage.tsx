import { Upload } from "lucide-react";
import { DragEvent, useState } from "react";
import { api } from "../api/client";

export function UploadPage({ onUploaded }: { onUploaded: () => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  async function handleFiles(fileList: FileList | File[] | null | undefined) {
    const files = Array.from(fileList ?? []).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (files.length === 0) return;
    setBusy(true);
    setMessage("");
    setUploadedFiles([]);
    try {
      const completed: string[] = [];
      for (const file of files) {
        await api.upload(file);
        completed.push(file.name);
        setUploadedFiles([...completed]);
        onUploaded();
      }
      setMessage(`${completed.length}개 파일 업로드 완료`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "업로드 실패");
    } finally {
      setBusy(false);
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
      {message ? <p className="notice">{message}</p> : null}
      {uploadedFiles.length > 0 ? (
        <ul className="upload-results">
          {uploadedFiles.map((fileName) => (
            <li key={fileName}>{fileName}</li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
