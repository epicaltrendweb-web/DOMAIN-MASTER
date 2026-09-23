'use client'

import { useCallback, useRef, useState } from 'react'
import {
  UploadCloud,
  CheckCircle2,
  Loader2,
  Folder,
  File as FileIcon,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type FileStage = 'uploading' | 'extracting' | 'done' | 'error'

type Entry = {
  name: string
  path: string
  size: number
  isDir: boolean
  ext: string
}

type Item = {
  id: string
  originalName: string
  size: number
  type: string
  stage: FileStage
  errorMsg?: string
  uploadPath?: string
  entries?: Entry[]
  totalFiles?: number
  targetDir?: string
  isZip: boolean
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export default function Home() {
  const [items, setItems] = useState<Item[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [dragCount, setDragCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const updateItem = useCallback((id: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  const processFile = useCallback(
    async (file: File) => {
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const isZip = file.name.toLowerCase().endsWith('.zip')
      const item: Item = {
        id,
        originalName: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        stage: 'uploading',
        isZip,
      }
      setItems((prev) => [item, ...prev])

      try {
        // 1) Subir
        const fd = new FormData()
        fd.append('file', file)
        const r = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await r.json()
        if (!data.ok) throw new Error(data.error || 'Error al subir')
        updateItem(id, { uploadPath: data.path })

        // 2) Si es zip, extraer
        if (isZip) {
          updateItem(id, { stage: 'extracting' })
          const er = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: data.name }),
          })
          const edata = await er.json()
          if (!edata.ok) throw new Error(edata.error || 'Error al extraer')
          updateItem(id, {
            stage: 'done',
            entries: edata.entries,
            totalFiles: edata.totalFiles,
            targetDir: edata.targetDir,
          })
        } else {
          updateItem(id, { stage: 'done' })
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        updateItem(id, { stage: 'error', errorMsg: msg })
      }
    },
    [updateItem]
  )

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files)
      if (arr.length === 0) return
      // Procesar en paralelo
      arr.forEach(processFile)
    },
    [processFile]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      setDragCount(0)
      const files = e.dataTransfer.files
      if (files && files.length) handleFiles(files)
    },
    [handleFiles]
  )

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length) handleFiles(files)
      if (inputRef.current) inputRef.current.value = ''
    },
    [handleFiles]
  )

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }, [])

  const clearAll = useCallback(() => setItems([]), [])

  const inProgress = items.filter(
    (it) => it.stage === 'uploading' || it.stage === 'extracting'
  ).length

  return (
    <main className="min-h-screen flex flex-col bg-neutral-50">
      <div className="flex-1 px-4 py-6 sm:py-8">
        <div className="w-full max-w-3xl mx-auto">
          {/* Título */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
              Subir archivos
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Arrastrá varios a la vez o hacé clic para elegirlos. Se suben y procesan solos.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
              setDragCount(e.dataTransfer.items?.length || 0)
            }}
            onDragLeave={() => {
              setDragOver(false)
              setDragCount(0)
            }}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed bg-white p-8 sm:p-12 text-center transition ${
              dragOver
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-neutral-300 hover:border-neutral-400'
            } ${inProgress > 0 ? 'pointer-events-none opacity-70' : ''}`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={onPick}
            />
            <div className="flex flex-col items-center gap-3">
              <UploadCloud className="h-10 w-10 text-neutral-400" />
              <div>
                <p className="text-sm font-medium text-neutral-700">
                  {dragOver && dragCount > 0
                    ? `Soltá ${dragCount} archivo${dragCount > 1 ? 's' : ''}`
                    : 'Soltá los archivos aquí'}
                </p>
                <p className="text-xs text-neutral-400">
                  o hacé clic para elegir (múltiples permitidos)
                </p>
              </div>
            </div>
          </div>

          {/* Lista de items */}
          {items.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  {items.length} archivo{items.length > 1 ? 's' : ''}
                  {inProgress > 0 && ` · ${inProgress} procesando`}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="h-7 text-xs text-neutral-500 hover:text-neutral-700"
                >
                  Limpiar lista
                </Button>
              </div>

              {items.map((it) => (
                <div
                  key={it.id}
                  className="rounded-xl border border-neutral-200 bg-white overflow-hidden"
                >
                  {/* Header del item */}
                  <div className="flex items-start gap-3 p-4">
                    <StatusIcon stage={it.stage} isZip={it.isZip} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900 text-sm truncate">
                          {it.originalName}
                        </span>
                        {it.isZip && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase">
                            zip
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {formatBytes(it.size)} · {it.type}
                        {it.totalFiles != null && ` · ${it.totalFiles} archivos extraídos`}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        {stageLabel(it)}
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(it.id)}
                      className="text-neutral-300 hover:text-red-500 p-1 -m-1"
                      title="Quitar de la lista"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Detalle del upload */}
                  {it.uploadPath && (
                    <div className="px-4 pb-2">
                      <div className="text-[11px] text-neutral-400 font-mono break-all bg-neutral-50 rounded px-2 py-1.5">
                        {it.uploadPath}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {it.stage === 'error' && it.errorMsg && (
                    <div className="px-4 pb-3">
                      <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded p-2">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{it.errorMsg}</span>
                      </div>
                    </div>
                  )}

                  {/* Contenido extraído */}
                  {it.stage === 'done' && it.entries && it.entries.length > 0 && (
                    <div className="border-t border-neutral-100 bg-neutral-50/50">
                      <div className="px-4 py-2 text-[11px] text-neutral-500 font-medium uppercase tracking-wide">
                        Contenido extraído {it.targetDir && `· ${it.targetDir.split('/').pop()}`}
                      </div>
                      <div className="max-h-60 overflow-y-auto px-2 pb-2">
                        <ul className="space-y-0.5">
                          {it.entries.map((e, i) => (
                            <li
                              key={i}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white text-[13px]"
                            >
                              {e.isDir ? (
                                <Folder className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                              ) : (
                                <FileIcon className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400" />
                              )}
                              <span
                                className={`flex-1 truncate ${
                                  e.isDir
                                    ? 'text-neutral-700 font-medium'
                                    : 'text-neutral-600'
                                }`}
                                style={{
                                  paddingLeft:
                                    e.name.split('/').length > 1
                                      ? `${(e.name.split('/').length - 1) * 12}px`
                                      : 0,
                                }}
                              >
                                {e.name.split('/').pop() || e.name}
                              </span>
                              {!e.isDir && (
                                <span className="text-[10px] text-neutral-400 flex-shrink-0">
                                  {formatBytes(e.size)}
                                </span>
                              )}
                              {e.ext && !e.isDir && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-500 uppercase flex-shrink-0">
                                  {e.ext}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="mt-auto border-t border-neutral-200 bg-white py-4 px-4 text-center text-xs text-neutral-400">
        Subida múltiple · los archivos se guardan en /home/z/my-project/upload/ · los ZIPs se extraen automáticamente
      </footer>
    </main>
  )
}

function StatusIcon({ stage, isZip }: { stage: FileStage; isZip: boolean }) {
  if (stage === 'uploading' || stage === 'extracting') {
    return <Loader2 className="h-5 w-5 mt-0.5 flex-shrink-0 animate-spin text-emerald-500" />
  }
  if (stage === 'error') {
    return (
      <div className="h-5 w-5 mt-0.5 flex-shrink-0 rounded-full bg-red-100 flex items-center justify-center">
        <AlertCircle className="h-3.5 w-3.5 text-red-600" />
      </div>
    )
  }
  return <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0 text-emerald-500" />
}

function stageLabel(it: Item): string {
  switch (it.stage) {
    case 'uploading':
      return 'Subiendo…'
    case 'extracting':
      return 'Extrayendo ZIP…'
    case 'error':
      return 'Falló'
    case 'done':
      return it.isZip ? 'Subido y extraído ✓' : 'Subido ✓'
  }
}
