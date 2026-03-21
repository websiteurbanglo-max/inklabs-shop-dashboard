"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/utils";

interface FileUploadProps {
  accept: string;
  maxSizeMB: number;
  onUpload: (url: string) => void;
  previewUrl?: string | null;
  onRemove?: () => void;
}

export default function FileUpload({
  accept,
  maxSizeMB,
  onUpload,
  previewUrl,
  onRemove,
}: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    // Validate type
    const allowedTypes = accept.split(",").map((t) => t.trim());
    if (!allowedTypes.includes(file.type)) {
      toast.error(`Invalid file type. Allowed: ${accept}`);
      return;
    }

    // Validate size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`File too large. Maximum size is ${maxSizeMB} MB.`);
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);
    setUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 15, 85));
      }, 300);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      onUpload(data.url);
      toast.success("Design uploaded successfully!");
    } catch (err) {
      toast.error((err as Error).message);
      setFileName(null);
      setFileSize(null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleRemove = () => {
    setFileName(null);
    setFileSize(null);
    onRemove?.();
  };

  if (previewUrl) {
    return (
      <div className="space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Uploaded design"
          className="max-w-full max-h-64 object-contain rounded-xl border border-gray-100 bg-gray-50"
        />
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {fileName && (
              <span>
                {fileName}
                {fileSize && (
                  <span className="text-gray-400 ml-1">
                    ({formatFileSize(fileSize)})
                  </span>
                )}
              </span>
            )}
          </div>
          <button
            onClick={handleRemove}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl h-52 flex flex-col items-center justify-center cursor-pointer transition-colors ${
          dragging
            ? "border-indigo-400 bg-indigo-50"
            : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
        } ${uploading ? "cursor-not-allowed" : ""}`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3 w-full px-8">
            <svg
              className="w-8 h-8 text-indigo-400 animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            <p className="text-sm text-gray-600">Uploading...</p>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <svg
              className="w-10 h-10 text-gray-300 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.25}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm font-medium text-gray-700">
              Drag and drop or{" "}
              <span className="text-indigo-600 font-semibold">click to upload</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PNG, JPEG up to {maxSizeMB} MB
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileInput}
        disabled={uploading}
      />
    </div>
  );
}
