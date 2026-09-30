'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { uploadAndParseReceipt } from '@/lib/receipt-upload';

export default function UploadReceipt() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file type
      if (!selectedFile.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      setFile(selectedFile);
      setError(null);
      setWarning(null);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setWarning(null);

    try {
      const result = await uploadAndParseReceipt(file, (stage) => {
        setUploading(stage !== 'parsing');
        setParsing(stage === 'parsing');
      });

      setFile(null);
      setPreview(null);
      setWarning(result.warning);

      // Refresh the page to show new receipt
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process receipt');
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const isProcessing = uploading || parsing;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xl font-bold">Upload Receipt</h2>
        <Link
          href="/receipts/import"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Have a lot? Bulk import →
        </Link>
      </div>

      {/* File Input */}
      <div className="mb-4">
        <label
          htmlFor="receipt-upload"
          className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
        >
          {preview ? (
            <img
              src={preview}
              alt="Receipt preview"
              className="h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="w-12 h-12 mb-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag
                and drop
              </p>
              <p className="text-xs text-gray-500">PNG, JPG, JPEG</p>
            </div>
          )}
          <input
            id="receipt-upload"
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isProcessing}
          />
        </label>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-3">
            <svg
              className="animate-spin h-5 w-5 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-900">
                {uploading
                  ? 'Uploading receipt...'
                  : 'Parsing receipt with AI...'}
              </p>
              <p className="text-xs text-blue-700">
                {uploading
                  ? 'Please wait while we upload your receipt'
                  : 'Extracting items, prices, and details'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Parsed, but the items don't add up to the total */}
      {warning && (
        <div className="mb-4 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
          <p className="font-medium mb-1">Check the prices</p>
          <p>{warning}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          <p className="font-medium mb-1">Failed to process receipt</p>
          <p>{error}</p>
          <p className="mt-2 text-xs">
            The receipt image and data have been removed. You can try uploading
            again.
          </p>
        </div>
      )}

      {/* Upload Button */}
      {file && (
        <div className="flex gap-2">
          <button
            onClick={handleUpload}
            disabled={isProcessing}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {uploading
              ? 'Uploading...'
              : parsing
              ? 'Parsing...'
              : 'Upload & Parse Receipt'}
          </button>
          <button
            onClick={() => {
              setFile(null);
              setPreview(null);
              setError(null);
            }}
            disabled={isProcessing}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
