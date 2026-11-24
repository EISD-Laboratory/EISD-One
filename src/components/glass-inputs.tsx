'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  FileSpreadsheet,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { cn } from './ui';

export function FieldGroup({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-[11.5px] font-semibold tracking-tight text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-violet-600">*</span>}
      </label>
      {children}
    </div>
  );
}

export interface GlassSelectOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Dropdown glassmorphism kustom pengganti <select> native browser.
 * Menggunakan Portal agar tidak terpotong oleh overflow/backdrop-filter kartu,
 * otomatis membuka ke atas/bawah sesuai ruang viewport, dan mendukung pencarian cepat.
 */
export function GlassSelect({
  value,
  onChange,
  options,
  placeholder = 'Pilih opsi...',
  size = 'md',
  searchable,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: GlassSelectOption[];
  placeholder?: string;
  size?: 'sm' | 'md';
  searchable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const showSearch = searchable ?? options.length > 6;

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint && o.hint.toLowerCase().includes(q)) ||
        o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const estimatedMenuHeight = Math.min(280, options.length * 40 + (showSearch ? 56 : 16));
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < estimatedMenuHeight && rect.top > spaceBelow;
      setCoords({
        top: openUp ? rect.top - 6 : rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 190) - 12),
        width: Math.max(rect.width, size === 'sm' ? 175 : rect.width),
        openUp,
      });
    }

    updatePosition();

    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, options.length, showSearch, size]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border border-violet-500/20 bg-white/75 text-left text-slate-800 shadow-[0_2px_8px_-4px_rgba(109,40,217,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-md transition hover:border-violet-400/50 hover:bg-white/90',
          size === 'sm' ? 'px-3 py-1.5 text-xs font-medium' : 'px-3.5 py-2 text-sm',
          open && 'border-violet-500/70 bg-white/95 ring-4 ring-violet-500/15',
        )}
      >
        <span className={cn('truncate', !selected && 'text-slate-400')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'shrink-0 text-violet-600 transition-transform duration-200',
            size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
            open && 'rotate-180',
          )}
        />
      </button>

      {open &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: coords.top,
              left: Math.max(8, coords.left),
              width: coords.width,
              transform: coords.openUp ? 'translateY(-100%)' : undefined,
              zIndex: 9999,
            }}
            className="overflow-hidden rounded-2xl border border-white/80 bg-white/85 p-1.5 shadow-[0_20px_48px_-14px_rgba(109,40,217,0.32),0_4px_14px_-4px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
          >
            {showSearch && (
              <div className="relative mb-1.5 px-1 pt-0.5">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-violet-500" />
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari pilihan..."
                  className="w-full rounded-xl border border-violet-200/70 bg-white/80 py-1.5 pr-3 pl-8 text-xs text-slate-800 placeholder:text-slate-400"
                />
              </div>
            )}

            <div className="max-h-60 overflow-y-auto pr-0.5">
              {filteredOptions.length === 0 ? (
                <p className="px-3 py-3 text-center text-xs text-slate-400">
                  Pilihan tidak ditemukan
                </p>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={`${opt.value}-${opt.label}`}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition',
                        isSelected
                          ? 'bg-brand-gradient-soft font-semibold text-violet-900 shadow-sm'
                          : 'text-slate-700 hover:bg-violet-50/75 hover:text-slate-900',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate">{opt.label}</p>
                        {opt.hint && (
                          <p className="truncate text-[10.5px] text-slate-500">{opt.hint}</p>
                        )}
                      </div>
                      {isSelected && (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/**
 * Area upload file modern (drag & drop + klik) pengganti <input type="file"> bawaan browser.
 */
export function GlassFileDropzone({
  file,
  onFileSelect,
  accept = '.xlsx,.csv',
  hint = 'Mendukung format .xlsx dan .csv',
  className,
}: {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  accept?: string;
  hint?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFileSelect(dropped);
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
        className="hidden"
      />

      {file ? (
        <div className="glass-tile flex items-center justify-between gap-3 rounded-2xl border-emerald-300/70 bg-emerald-50/55 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">{file.name}</p>
              <p className="text-[11px] text-emerald-700">
                {(file.size / 1024).toFixed(1)} KB · Siap diproses
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onFileSelect(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
            title="Hapus file terpilih"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'group flex cursor-pointer items-center gap-3.5 rounded-2xl border border-dashed px-4 py-3.5 backdrop-blur-md transition-all',
            dragging
              ? 'border-emerald-500 bg-emerald-50/60 ring-4 ring-emerald-500/15'
              : 'border-violet-300/80 bg-white/55 hover:border-violet-500/70 hover:bg-white/80',
          )}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient-soft text-violet-700 transition group-hover:scale-105">
            <UploadCloud className="h-5 w-5 text-emerald-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800">
              Klik untuk pilih file{' '}
              <span className="font-normal text-slate-500">atau seret ke sini</span>
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
          </div>
          <span className="hidden rounded-full border border-violet-200/80 bg-white/85 px-3 py-1 text-[11px] font-semibold text-violet-700 sm:inline-block">
            Browse
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Modal peringatan konfirmasi bergaya glassmorphism di tengah layar (pengganti confirm() bawaan browser).
 */
export function GlassConfirmDialog({
  open,
  title,
  description,
  itemLabel,
  confirmLabel = 'Ya, Hapus',
  cancelLabel = 'Batal',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  itemLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, loading, onCancel]);

  if (!open || typeof document === 'undefined') return null;

  const isDanger = variant === 'danger';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-md"
      onClick={() => {
        if (!loading) onCancel();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="glass-panel relative w-full max-w-md overflow-hidden rounded-3xl bg-white/80 shadow-[0_28px_64px_-16px_rgba(109,40,217,0.38)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            'h-1.5 w-full',
            isDanger
              ? 'bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-600'
              : 'bg-brand-gradient',
          )}
        />

        <div className="p-6 text-center">
          <div
            className={cn(
              'mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ring-4',
              isDanger
                ? 'bg-gradient-to-br from-rose-500 to-violet-600 text-white ring-rose-100/80'
                : 'bg-brand-gradient text-white ring-violet-100/80',
            )}
          >
            {isDanger ? <Trash2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>

          <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-900">{title}</h3>

          {itemLabel && (
            <div className="glass-tile mx-auto mt-2.5 inline-block max-w-full rounded-xl px-3.5 py-1.5 text-xs font-semibold text-violet-900">
              <span className="block truncate">{itemLabel}</span>
            </div>
          )}

          <p className="mt-3 text-xs leading-relaxed text-slate-600">{description}</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={onCancel}
              className="glass-tile rounded-xl py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-white/95 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className={cn(
                'rounded-xl py-2.5 text-xs font-semibold text-white shadow-lg transition hover:brightness-105 disabled:opacity-50',
                isDanger
                  ? 'bg-gradient-to-r from-rose-500 via-pink-600 to-violet-600 shadow-rose-500/25'
                  : 'btn-brand',
              )}
            >
              {loading ? 'Memproses...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
