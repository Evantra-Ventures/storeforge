"use client";

import { ChangeEvent, useState } from "react";
import { uploadFile } from "@/lib/storage/upload-file";

type FileUploaderProps = {
  bucket: string;
  tenantId: string;
  folder?: string;
  accept?: string;
  label?: string;
  onUploadComplete: (url: string, path: string) => void;
};

export default function FileUploader({
  bucket,
  tenantId,
  folder,
  accept = "image/png,image/jpeg,image/webp",
  label = "Upload File",
  onUploadComplete,
}: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      setErrorMessage("");

      const file = event.target.files?.[0];

      if (!file) return;

      setPreviewUrl(URL.createObjectURL(file));
      setUploading(true);

      const result = await uploadFile({
        bucket,
        file,
        tenantId,
        folder,
      });

      if (!result.success || !result.publicUrl || !result.path) {
        setErrorMessage("Upload failed. Please try again.");
        return;
      }

      onUploadComplete(result.publicUrl, result.path);
    } catch (error) {
      console.error(error);
      setErrorMessage("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          {label}
        </label>

        <input
          type="file"
          accept={accept}
          onChange={handleUpload}
          disabled={uploading}
          className="w-full border rounded-xl p-3"
        />
      </div>

      {uploading && (
        <p className="text-sm text-slate-500">
          Uploading...
        </p>
      )}

      {errorMessage && (
        <div className="bg-red-100 text-red-700 p-3 rounded-xl text-sm">
          {errorMessage}
        </div>
      )}

      {previewUrl && (
        <div className="border rounded-2xl p-4">
          <p className="text-sm font-medium mb-3">
            Preview
          </p>

          <img
            src={previewUrl}
            alt="Upload preview"
            className="w-40 h-40 object-cover rounded-xl border"
          />
        </div>
      )}
    </div>
  );
}