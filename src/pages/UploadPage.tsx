import { Upload } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client";

export function UploadPage({ onUploaded }: { onUploaded: () => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await api.upload(file);
      setMessage(result.message ?? result.status);
      onUploaded();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "업로드 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="upload-page">
      <label className="dropzone">
        <Upload aria-hidden="true" />
        <strong>MSDS PDF 업로드</strong>
        <span>텍스트 레이어, SECTION 3 성분표, 스캔본 여부를 로컬에서 먼저 확인합니다.</span>
        <input disabled={busy} type="file" accept="application/pdf" onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} />
      </label>
      {message ? <p className="notice">{message}</p> : null}
    </main>
  );
}
