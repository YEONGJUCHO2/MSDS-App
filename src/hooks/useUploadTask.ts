import { useState } from "react";
import { MAX_UPLOAD_FILES_PER_BATCH } from "../../shared/uploadLimits";
import { api, type UploadBatchResult } from "../api/client";

export type UploadTaskState = {
  busy: boolean;
  message: string;
  pendingFiles: File[];
  uploadResults: UploadBatchResult[];
};

export const idleUploadTask: UploadTaskState = {
  busy: false,
  message: "",
  pendingFiles: [],
  uploadResults: []
};

export function useUploadTask(onUploaded: () => void) {
  const [task, setTask] = useState<UploadTaskState>(idleUploadTask);

  async function startUpload(fileList: FileList | File[] | null | undefined) {
    const files = Array.from(fileList ?? []).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (files.length === 0) return;
    if (files.length > MAX_UPLOAD_FILES_PER_BATCH) {
      setTask({
        busy: false,
        message: `한 번에 최대 ${MAX_UPLOAD_FILES_PER_BATCH}개까지만 업로드할 수 있습니다. ${MAX_UPLOAD_FILES_PER_BATCH}개씩 나눠 올려주세요.`,
        pendingFiles: [],
        uploadResults: []
      });
      return;
    }

    setTask({
      busy: true,
      message: "",
      pendingFiles: files,
      uploadResults: []
    });

    try {
      const result = await api.uploadBatch(files);
      const completed = result.results.filter((item) => item.success);
      const failed = result.results.filter((item) => !item.success);
      completed.forEach(() => onUploaded());
      setTask({
        busy: false,
        message: formatUploadMessage(completed.length, failed.length),
        pendingFiles: [],
        uploadResults: result.results
      });
    } catch (error) {
      setTask({
        busy: false,
        message: error instanceof Error ? error.message : "업로드 실패",
        pendingFiles: [],
        uploadResults: []
      });
    }
  }

  return { task, startUpload };
}

function formatUploadMessage(completedCount: number, failedCount: number) {
  if (failedCount === 0) return `${completedCount}개 파일 업로드 완료`;
  if (completedCount === 0) return `${failedCount}개 파일 실패`;
  return `${completedCount}개 파일 업로드 완료, ${failedCount}개 파일 실패`;
}
