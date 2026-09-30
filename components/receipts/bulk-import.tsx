'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  findPossibleDuplicate,
  uploadAndParseReceipt,
  type ParsedReceiptSummary,
  type PossibleDuplicate,
} from '@/lib/receipt-upload';

// How many receipts are processed at once. Each parse can take 20-40s, so
// this keeps a batch moving without hammering the API.
const CONCURRENCY = 3;

type Status = 'queued' | 'preparing' | 'uploading' | 'parsing' | 'done' | 'failed';

interface Entry {
  id: string;
  file: File;
  previewUrl: string;
  status: Status;
  error: string | null;
  result: ParsedReceiptSummary | null;
  duplicate: PossibleDuplicate | null;
}

const STATUS_LABELS: Record<Status, string> = {
  queued: 'Waiting',
  preparing: 'Preparing…',
  uploading: 'Uploading…',
  parsing: 'Reading receipt…',
  done: 'Done',
  failed: 'Failed',
};

const isActive = (status: Status) =>
  status === 'preparing' || status === 'uploading' || status === 'parsing';

// Same name, size and modified time means the same file was picked twice
const fileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

function formatDate(dateString: string | null): string {
  if (!dateString) return 'No date';
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function BulkImport() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [skippedCount, setSkippedCount] = useState(0);
  const entriesRef = useRef<Entry[]>([]);
  const router = useRouter();

  entriesRef.current = entries;

  const updateEntry = useCallback((id: string, changes: Partial<Entry>) => {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry))
    );
  }, []);

  // Closing the tab stops the import, since it runs in the browser
  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  // Free the preview images when leaving the page
  useEffect(
    () => () => entriesRef.current.forEach((entry) => URL.revokeObjectURL(entry.previewUrl)),
    []
  );

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const existing = new Set(entriesRef.current.map((entry) => fileKey(entry.file)));
    const added: Entry[] = [];
    let skipped = 0;

    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/') || existing.has(fileKey(file))) {
        skipped++;
        continue;
      }
      existing.add(fileKey(file));
      added.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'queued',
        error: null,
        result: null,
        duplicate: null,
      });
    }

    setSkippedCount(skipped);
    setEntries((current) => [...current, ...added]);
  };

  const removeEntry = (id: string) => {
    const entry = entriesRef.current.find((e) => e.id === id);
    if (entry) URL.revokeObjectURL(entry.previewUrl);
    setEntries((current) => current.filter((e) => e.id !== id));
  };

  const processEntry = async (entry: Entry) => {
    updateEntry(entry.id, { status: 'preparing', error: null });
    try {
      const result = await uploadAndParseReceipt(entry.file, (stage) =>
        updateEntry(entry.id, { status: stage })
      );
      const duplicate = await findPossibleDuplicate(result);
      updateEntry(entry.id, { status: 'done', result, duplicate });
    } catch (err: unknown) {
      updateEntry(entry.id, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Something went wrong',
      });
    }
  };

  // Works through the given entries, CONCURRENCY at a time
  const runQueue = async (queue: Entry[]) => {
    setRunning(true);
    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        await processEntry(queue[next++]);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
    router.refresh();
  };

  const importQueued = () =>
    runQueue(entriesRef.current.filter((entry) => entry.status === 'queued'));

  const retryFailed = () =>
    runQueue(entriesRef.current.filter((entry) => entry.status === 'failed'));

  const clearFinished = () => {
    entriesRef.current
      .filter((entry) => entry.status === 'done')
      .forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
    setEntries((current) => current.filter((entry) => entry.status !== 'done'));
  };

  const counts = {
    total: entries.length,
    queued: entries.filter((e) => e.status === 'queued').length,
    active: entries.filter((e) => isActive(e.status)).length,
    done: entries.filter((e) => e.status === 'done').length,
    failed: entries.filter((e) => e.status === 'failed').length,
    needsReview: entries.filter((e) => e.result?.needsReview).length,
    noDate: entries.filter((e) => e.status === 'done' && !e.result?.purchaseDate).length,
    duplicates: entries.filter((e) => e.duplicate).length,
  };
  const finished = counts.done + counts.failed;
  const started = finished + counts.active > 0;

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <label
        htmlFor="bulk-upload"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:bg-gray-50'
        }`}
      >
        <svg className="w-12 h-12 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="mb-1 text-sm text-gray-600">
          <span className="font-semibold">Click to choose photos</span> or drag and drop
        </p>
        <p className="text-xs text-gray-500">
          Select as many receipts as you like. They&apos;re resized before uploading.
        </p>
        <input
          id="bulk-upload"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {skippedCount > 0 && (
        <p className="text-sm text-gray-500">
          Skipped {skippedCount} file{skippedCount !== 1 ? 's' : ''} that weren&apos;t images or
          were already added.
        </p>
      )}

      {entries.length > 0 && (
        <>
          {/* Controls and progress */}
          <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-48">
              <p className="font-medium">
                {running
                  ? `Importing… ${finished} of ${counts.total} finished`
                  : started
                  ? `${counts.done} imported${counts.failed ? `, ${counts.failed} failed` : ''}`
                  : `${counts.total} receipt${counts.total !== 1 ? 's' : ''} ready to import`}
              </p>
              {started && (
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${(finished / counts.total) * 100}%` }}
                  />
                </div>
              )}
              {running && (
                <p className="text-xs text-gray-500 mt-1">
                  Keep this tab open until the import finishes.
                </p>
              )}
            </div>
            {counts.queued > 0 && !running && (
              <button
                onClick={importQueued}
                className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Import {counts.queued} receipt{counts.queued !== 1 ? 's' : ''}
              </button>
            )}
            {counts.failed > 0 && !running && (
              <button
                onClick={retryFailed}
                className="py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Retry {counts.failed} failed
              </button>
            )}
            {counts.done > 0 && !running && (
              <button
                onClick={clearFinished}
                className="py-2 px-4 text-sm text-gray-600 hover:text-gray-900"
              >
                Clear finished
              </button>
            )}
          </div>

          {/* Summary once everything has been processed */}
          {!running && started && counts.queued === 0 && (
            <div className="bg-white rounded-lg shadow p-4 text-sm space-y-1">
              <p className="font-medium text-base mb-2">Import summary</p>
              <p>✅ {counts.done} receipt{counts.done !== 1 ? 's' : ''} imported</p>
              {counts.failed > 0 && <p>❌ {counts.failed} failed. You can retry them above.</p>}
              {counts.needsReview > 0 && (
                <p>⚠️ {counts.needsReview} need a price check (items don&apos;t add up to the total)</p>
              )}
              {counts.duplicates > 0 && (
                <p>🔁 {counts.duplicates} may be duplicates of receipts you already have</p>
              )}
              {counts.noDate > 0 && (
                <p>📅 {counts.noDate} had no readable date. Add one on the receipt page.</p>
              )}
              <p className="pt-2">
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
                  View all receipts →
                </Link>
              </p>
            </div>
          )}

          {/* Per-receipt status */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {entries.map((entry) => (
              <div key={entry.id} className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
                <div className="relative aspect-[3/4] bg-gray-100">
                  <img
                    src={entry.previewUrl}
                    alt={entry.file.name}
                    className={`w-full h-full object-cover ${isActive(entry.status) ? 'opacity-60' : ''}`}
                  />
                  {entry.status === 'queued' && !running && (
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow text-sm"
                      aria-label={`Remove ${entry.file.name}`}
                    >
                      ✕
                    </button>
                  )}
                  {isActive(entry.status) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-3 text-sm flex-1">
                  {entry.status === 'done' && entry.result ? (
                    <>
                      <Link
                        href={`/receipts/${entry.result.receiptId}`}
                        className="font-semibold text-blue-600 hover:text-blue-700"
                      >
                        {entry.result.storeName || 'Unknown store'}
                      </Link>
                      <p className="text-gray-600">
                        {formatDate(entry.result.purchaseDate)} ·{' '}
                        {entry.result.totalAmount != null
                          ? `$${entry.result.totalAmount.toFixed(2)}`
                          : 'No total'}
                      </p>
                      <p className="text-gray-500">{entry.result.itemCount} items</p>
                      {entry.result.needsReview && (
                        <p className="mt-1 text-amber-700">⚠️ Check prices</p>
                      )}
                      {entry.duplicate && (
                        <p className="mt-1 text-amber-700">
                          🔁 Possible duplicate of{' '}
                          <Link
                            href={`/receipts/${entry.duplicate.id}`}
                            className="underline hover:text-amber-900"
                          >
                            {entry.duplicate.storeName || 'a receipt'}
                            {entry.duplicate.purchaseDate
                              ? ` (${formatDate(entry.duplicate.purchaseDate)})`
                              : ''}
                          </Link>
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="truncate text-gray-700" title={entry.file.name}>
                        {entry.file.name}
                      </p>
                      <p
                        className={
                          entry.status === 'failed' ? 'text-red-600' : 'text-gray-500'
                        }
                      >
                        {STATUS_LABELS[entry.status]}
                      </p>
                      {entry.error && <p className="mt-1 text-xs text-red-600">{entry.error}</p>}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
