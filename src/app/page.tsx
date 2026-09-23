'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloud, FileArchive, CheckCircle2, Loader2, Folder, File as FileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Stage = 'idle' | 'uploading' | 'uploaded' | 'extracting' | 'done' | 'error'

type Entry = {
  name: string
  path: string
  size: number
  isDir: boolean
  ext: string
}

type UploadResult = {
  ok: boolean
  name?: string
  originalName?: string
  size?: number
  type?: string
  path?: string
  savedAt?: string
  error?: string
}

type ExtractResult = {
  ok: boolean
  name?: string
  zipPath?: string
  targetDir?: string
  totalFiles?: number
  totalSize?: number
  entries?: Entry[]
  truncated?: boolean
  error?: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export default function Home() {
  const [stage, setStage] = useState<Stage>('idle')
  const [dragOver, setDragOver] = useState(false)
  const [uploadRes, setUploadRes] = useState<UploadResult | null>(null)
  const [extractRes, setExtractRes] = useState<ExtractResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setStage('uploading')
    setErrorMsg('')
    setUploadRes(null)
    setExtractRes(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/upload', { method: 'POST', body: fd })
      const data: UploadResult = await r.json()
      if (!data.ok) {
        throw new Error(data.error || 'Error al subir')
      }
      setUploadRes(data)
      setStage('uploaded')

      // Si es zip, extraer automáticamente
      const isZip = file.name.toLowerCase().endsWith('.zip')
      if (isZip) {
        setStage('extracting')
        const er = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: data.name }),
        })
        const edata: ExtractResult = await er.json()
        if (!edata.ok) {
          throw new Error(edata.error || 'Error al extraer')
        }
        setExtractRes(edata)
        setStage('done')
      } else {
        setStage('done')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMsg(msg)
      setStage('error')
    }
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const reset = useCallback(() => {
    setStage('idle')
    setUploadRes(null)
    setExtractRes(null)
    setErrorMsg('')
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  return (
    <main className="min-h-screen flex flex-col bg-neutral-50">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-2xl">
          {/* Título */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
              Subir archivo
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Arrastrá el archivo o hacé clic para elegirlo. Se detecta y procesa solo.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed bg-white p-8 sm:p-12 text-center transition ${
              dragOver
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-neutral-300 hover:border-neutral-400'
            } ${stage === 'uploading' || stage === 'extracting' ? 'pointer-events-none opacity-70' : ''}`}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={onPick}
            />

            <div className="flex flex-col items-center gap-3">
              {stage === 'idle' && (
                <>
                  <UploadCloud className="h-10 w-10 text-neutral-400" />
                  <div>
                    <p className="text-sm font-medium text-neutral-700">
                      Soltá el archivo aquí
                    </p>
                    <p className="text-xs text-neutral-400">
                      o hacé clic para elegir
                    </p>
                  </div>
                </>
              )}

              {(stage === 'uploading' || stage === 'extracting') && (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
                  <p className="text-sm font-medium text-neutral-700">
                    {stage === 'uploading' ? 'Subiendo…' : 'Extrayendo ZIP…'}
                  </p>
                </>
              )}

              {stage === 'uploaded' && (
                <>
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  <p className="text-sm font-medium text-neutral-700">
                    Subido ✓
                  </p>
                </>
              )}

              {stage === 'done' && (
                <>
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  <p className="text-sm font-medium text-neutral-700">
                    {extractRes ? 'Extraído ✓' : 'Subido ✓'}
                  </p>
                </>
              )}

              {stage === 'error' && (
                <>
                  <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-red-600 text-xl">!</span>
                  </div>
                  <p className="text-sm font-medium text-red-700">
                    Error al procesar
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Detalle del upload */}
          {uploadRes && (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <FileArchive className="h-5 w-5 mt-0.5 text-neutral-500 flex-shrink-0" />
                <div className="flex-1 min-w-0 text-sm">
                  <div className="font-medium text-neutral-900 truncate">
                    {uploadRes.originalName}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {uploadRes.size != null && formatBytes(uploadRes.size)}
                    {uploadRes.type ? ` · ${uploadRes.type}` : ''}
                  </div>
                  {uploadRes.path && (
                    <div className="text-[11px] text-neutral-400 mt-1 font-mono break-all">
                      {uploadRes.path}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Detalle de extracción */}
          {extractRes?.ok && extractRes.entries && (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-neutral-900">
                  Contenido extraído
                </div>
                <div className="text-xs text-neutral-500">
                  {extractRes.totalFiles} archivos
                  {extractRes.truncated ? ' (mostrando 200)' : ''}
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto -mx-1">
                <ul className="space-y-0.5 text-sm">
                  {extractRes.entries.map((e, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-50"
                    >
                      {e.isDir ? (
                        <Folder className="h-4 w-4 flex-shrink-0 text-amber-500" />
                      ) : (
                        <FileIcon className="h-4 w-4 flex-shrink-0 text-neutral-400" />
                      )}
                      <span
                        className={`flex-1 truncate ${
                          e.isDir
                            ? 'text-neutral-700 font-medium'
                            : 'text-neutral-600'
                        }`}
                        style={{ paddingLeft: e.name.split('/').length > 1 ? `${(e.name.split('/').length - 1) * 12}px` : 0 }}
                      >
                        {e.name.split('/').pop() || e.name}
                      </span>
                      {!e.isDir && (
                        <span className="text-[11px] text-neutral-400 flex-shrink-0">
                          {formatBytes(e.size)}
                        </span>
                      )}
                      {e.ext && !e.isDir && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 uppercase flex-shrink-0">
                          {e.ext}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 text-[11px] text-neutral-400 font-mono break-all">
                {extractRes.targetDir}
              </div>
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Acciones */}
          <div className="mt-6 flex items-center justify-center gap-3">
            {stage === 'done' || stage === 'error' ? (
              <Button variant="outline" onClick={reset}>
                Subir otro
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="mt-auto border-t border-neutral-200 bg-white py-4 px-4 text-center text-xs text-neutral-400">
        Subida simple de archivos · los archivos se guardan en /home/z/my-project/upload/
      </footer>
    </main>
  )
}
