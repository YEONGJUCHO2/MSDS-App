import { LoaderCircle, Upload } from "lucide-react";
import { DragEvent, useState } from "react";
import { MAX_UPLOAD_FILES_PER_BATCH } from "../../shared/uploadLimits";
import { type UploadTaskState, useUploadTask } from "../hooks/useUploadTask";

type UploadPageProps = {
  onUploaded?: () => void;
  uploadTask?: UploadTaskState;
  onFilesSelected?: (fileList: FileList | File[] | null | undefined) => void;
};

export function UploadPage({ onUploaded = () => undefined, uploadTask, onFilesSelected }: UploadPageProps) {
  const localUpload = useUploadTask(onUploaded);
  const task = uploadTask ?? localUpload.task;
  const startUpload = onFilesSelected ?? localUpload.startUpload;
  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (!task.busy) setIsDragging(true);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (!task.busy) void startUpload(event.dataTransfer.files);
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
        <strong>{task.busy ? "업로드 처리중" : "MSDS PDF 업로드"}</strong>
        <span>PDF 파일을 선택하거나 이 영역에 끌어다 놓으세요.</span>
        <input
          data-testid="msds-file-input"
          disabled={task.busy}
          type="file"
          accept="application/pdf"
          multiple
          onChange={(event) => void startUpload(event.target.files)}
        />
      </label>
      <UploadTaskFeedback task={task} />
    </main>
  );
}

export function UploadTaskFeedback({ task }: { task: UploadTaskState }) {
  return (
    <>
      {task.busy ? (
        <section aria-live="polite" className="upload-progress-panel">
          <div className="upload-progress-title">
            <LoaderCircle aria-hidden="true" className="upload-spinner" />
            <div>
              <strong>업로드 중 {task.pendingFiles.length}/{MAX_UPLOAD_FILES_PER_BATCH}</strong>
              <span>파일을 분석하고 목록에 반영하는 중입니다.</span>
            </div>
          </div>
          <div aria-label="MSDS 업로드 진행 중" className="upload-progress-bar" role="progressbar">
            <span />
          </div>
          <ul className="upload-pending-list">
            {task.pendingFiles.map((file) => (
              <li key={`${file.name}-${file.size}`}>
                <span>{file.name}</span>
                <em>대기 중</em>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {task.message ? <p className="notice">{task.message}</p> : null}
      {task.uploadResults.length > 0 ? (
        <ul className="upload-results">
          {task.uploadResults.map((result) => (
            <li key={result.fileName}>
              {result.success ? result.fileName : `${result.fileName}: ${result.error}`}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
