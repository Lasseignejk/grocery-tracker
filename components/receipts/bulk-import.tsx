'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  findPossibleDuplicate,
  looksLikePartOfReceipt,
  mergeReceipts,
  uploadAndParseReceipt,
  type ParsedReceiptSummary,
  type PossibleDuplicate,
} from '@/lib/receipt-upload';

// How many receipts are processed at once. Each parse can take 20-40s, so
// this keeps a batch moving without hammering the API.
const CONCURRENCY = 3;

type Status = 'queued' | 'preparing' | 'uploading' | 'parsing' | 'done' | 'failed';

// One receipt, which may have been photographed in several parts
interface Entry {
  id: string;
  files: File[];
  previewUrls: string[];
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

// Neighbouring receipts that both failed the totals check, where at least one
// is missing its total or store, are probably two photos of one receipt
function findSuggestedPairs(entries: Entry[]): Map<string, string> {
  const pairs = new Map<string, string>();
  for (let i = 0; i < entries.length - 1; i++) {
    const [a, b] = [entries[i].result, entries[i + 1].result];
    if (!a || !b || !a.needsReview || !b.needsReview) continue;
    if (!looksLikePartOfReceipt(a) && !looksLikePartOfReceipt(b)) continue;
    pairs.set(entries[i].id, entries[i + 1].id);
    i++; // each receipt is suggested at most once
  }
  return pairs;
}

export default function BulkImport() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [merging, setMerging] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [skippedCount, setSkippedCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const entriesRef = useRef<Entry[]>([]);
  const router = useRouter();

  entriesRef.current = entries;
  const busy = running || merging;

  const updateEntry = useCallback((id: string, changes: Partial<Entry>) => {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry))
    );
  }, []);

  // Closing the tab stops the import, since it runs in the browser
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  // Free the preview images when leaving the page
  useEffect(
    () => () =>
      entriesRef.current.forEach((entry) => entry.previewUrls.forEach(URL.revokeObjectURL)),
    []
  );

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const existing = new Set(entriesRef.current.flatMap((entry) => entry.files.map(fileKey)));
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
        files: [file],
        previewUrls: [URL.createObjectURL(file)],
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
    entriesRef.current.find((e) => e.id === id)?.previewUrls.forEach(URL.revokeObjectURL);
    setEntries((current) => current.filter((e) => e.id !== id));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Before import: turn the selected photos into one multi-photo receipt,
  // in the order they appear in the grid
  const groupQueued = (ids: string[]) => {
    const group = entriesRef.current.filter((e) => ids.includes(e.id));
    const combined: Entry = {
      ...group[0],
      files: group.flatMap((e) => e.files),
      previewUrls: group.flatMap((e) => e.previewUrls),
    };
    setEntries((current) =>
      current
        .filter((e) => e === group[0] || !ids.includes(e.id))
        .map((e) => (e.id === combined.id ? combined : e))
    );
  };

  // Undo a grouping before import
  const splitQueued = (id: string) => {
    const entry = entriesRef.current.find((e) => e.id === id);
    if (!entry) return;
    const parts: Entry[] = entry.files.map((file, index) => ({
      ...entry,
      id: index === 0 ? entry.id : crypto.randomUUID(),
      files: [file],
      previewUrls: [entry.previewUrls[index]],
    }));
    setEntries((current) => current.flatMap((e) => (e.id === id ? parts : [e])));
  };

  // After import: merge receipts that turned out to be parts of one receipt
  const mergeDone = async (ids: string[]) => {
    const group = entriesRef.current.filter((e) => ids.includes(e.id) && e.result);
    if (group.length < 2) return;
    const [first, ...rest] = group;

    setMerging(true);
    setNotice(null);
    updateEntry(first.id, { status: 'parsing', error: null });
    try {
      const result = await mergeReceipts(group.map((e) => e.result!.receiptId));
      const duplicate = await findPossibleDuplicate(result);
      setEntries((current) =>
        current
          .filter((e) => !rest.some((r) => r.id === e.id))
          .map((e) =>
            e.id === first.id
              ? {
                  ...e,
                  files: group.flatMap((g) => g.files),
                  previewUrls: group.flatMap((g) => g.previewUrls),
                  status: 'done',
                  result,
                  duplicate,
                }
              : e
          )
      );
      router.refresh();
    } catch (err: unknown) {
      // The receipts are left exactly as they were
      updateEntry(first.id, { status: 'done' });
      setNotice(
        `Couldn't combine those receipts: ${err instanceof Error ? err.message : 'something went wrong'}`
      );
    } finally {
      setMerging(false);
    }
  };

  const combineSelected = () => {
    const ids = entries.filter((e) => selected.has(e.id)).map((e) => e.id);
    setSelected(new Set());
    if (entries.filter((e) => ids.includes(e.id)).every((e) => e.status === 'queued')) {
      groupQueued(ids);
    } else {
      mergeDone(ids);
    }
  };

  const processEntry = async (entry: Entry) => {
    updateEntry(entry.id, { status: 'preparing', error: null });
    try {
      const result = await uploadAndParseReceipt(entry.files, (stage) =>
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
    setSelected(new Set());
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
      .forEach((entry) => entry.previewUrls.forEach(URL.revokeObjectURL));
    setEntries((current) => current.filter((entry) => entry.status !== 'done'));
    setSelected(new Set());
  };

  const suggestedPairs = busy ? new Map<string, string>() : findSuggestedPairs(entries);
  const selectedEntries = entries.filter((e) => selected.has(e.id));
  const canCombine =
    !busy &&
    selectedEntries.length >= 2 &&
    (selectedEntries.every((e) => e.status === 'queued') ||
      selectedEntries.every((e) => e.status === 'done'));

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
                  : merging
                  ? 'Combining receipts…'
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
              {busy ? (
                <p className="text-xs text-gray-500 mt-1">
                  Keep this tab open until it finishes.
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Long receipt in several photos? Tick them and choose Combine.
                </p>
              )}
            </div>
            {selectedEntries.length > 0 && (
              <button
                onClick={combineSelected}
                disabled={!canCombine}
                title={
                  canCombine
                    ? undefined
                    : 'Select two or more photos that are all waiting, or all imported'
                }
                className="py-2 px-4 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent transition-colors"
              >
                Combine {selectedEntries.length} into one receipt
              </button>
            )}
            {counts.queued > 0 && !busy && (
              <button
                onClick={importQueued}
                className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Import {counts.queued} receipt{counts.queued !== 1 ? 's' : ''}
              </button>
            )}
            {counts.failed > 0 && !busy && (
              <button
                onClick={retryFailed}
                className="py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Retry {counts.failed} failed
              </button>
            )}
            {counts.done > 0 && !busy && (
              <button
                onClick={clearFinished}
                className="py-2 px-4 text-sm text-gray-600 hover:text-gray-900"
              >
                Clear finished
              </button>
            )}
          </div>

          {notice && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{notice}</div>
          )}

          {/* Summary once everything has been processed */}
          {!busy && started && counts.queued === 0 && (
            <div className="bg-white rounded-lg shadow p-4 text-sm space-y-1">
              <p className="font-medium text-base mb-2">Import summary</p>
              <p>✅ {counts.done} receipt{counts.done !== 1 ? 's' : ''} imported</p>
              {counts.failed > 0 && <p>❌ {counts.failed} failed. You can retry them above.</p>}
              {suggestedPairs.size > 0 && (
                <p>
                  🧩 {suggestedPairs.size} pair{suggestedPairs.size !== 1 ? 's' : ''} of photos look
                  like parts of one receipt. Combine them below.
                </p>
              )}
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
            {entries.map((entry) => {
              const pairedWith = suggestedPairs.get(entry.id);
              const selectable = !busy && (entry.status === 'queued' || entry.status === 'done');
              return (
                <div
                  key={entry.id}
                  className={`bg-white rounded-lg shadow overflow-hidden flex flex-col ${
                    selected.has(entry.id) ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="relative aspect-[3/4] bg-gray-100">
                    <img
                      src={entry.previewUrls[0]}
                      alt={entry.files[0].name}
                      className={`w-full h-full object-cover ${isActive(entry.status) ? 'opacity-60' : ''}`}
                    />
                    {selectable && (
                      <label className="absolute top-2 left-2 flex items-center justify-center w-7 h-7 rounded bg-white/90 shadow cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected.has(entry.id)}
                          onChange={() => toggleSelected(entry.id)}
                          aria-label={`Select ${entry.files[0].name}`}
                        />
                      </label>
                    )}
                    {entry.files.length > 1 && (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs">
                        📄 {entry.files.length} photos
                      </span>
                    )}
                    {entry.status === 'queued' && !busy && (
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow text-sm"
                        aria-label={`Remove ${entry.files[0].name}`}
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
                          {entry.result.totalAmount
                            ? `$${entry.result.totalAmount.toFixed(2)}`
                            : 'No total'}
                        </p>
                        <p className="text-gray-500">{entry.result.itemCount} items</p>
                        {pairedWith ? (
                          <button
                            onClick={() => mergeDone([entry.id, pairedWith])}
                            className="mt-2 w-full py-1.5 px-2 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium text-left"
                          >
                            🧩 This and the next photo look like one receipt. Combine them
                          </button>
                        ) : (
                          entry.result.needsReview && (
                            <p className="mt-1 text-amber-700">⚠️ Check prices</p>
                          )
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
                        <p className="truncate text-gray-700" title={entry.files.map((f) => f.name).join(', ')}>
                          {entry.files[0].name}
                          {entry.files.length > 1 ? ` + ${entry.files.length - 1} more` : ''}
                        </p>
                        <p className={entry.status === 'failed' ? 'text-red-600' : 'text-gray-500'}>
                          {STATUS_LABELS[entry.status]}
                        </p>
                        {entry.error && <p className="mt-1 text-xs text-red-600">{entry.error}</p>}
                        {entry.status === 'queued' && entry.files.length > 1 && !busy && (
                          <button
                            onClick={() => splitQueued(entry.id)}
                            className="mt-1 text-xs text-blue-600 hover:text-blue-700"
                          >
                            Split back into separate receipts
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
