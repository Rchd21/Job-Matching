import * as React from 'react'

export interface FileWithPreview {
  id: string
  file: File
  preview: string | null
}

interface Options {
  accept?: string
  maxSize: number
  maxFiles: number
  onUpload?: (file: File) => Promise<unknown> | void
  onRemove?: () => void
}

function matchesAccept(file: File, accept?: string) {
  if (!accept) return true
  const name = file.name.toLowerCase()
  return accept.split(',').map((a) => a.trim().toLowerCase()).some((a) =>
    a.startsWith('.') ? name.endsWith(a) : a.endsWith('/*') ? file.type.startsWith(a.slice(0, -1)) : file.type === a,
  )
}

export function useFileUpload({ accept, maxSize, maxFiles, onUpload, onRemove }: Options) {
  const [files, setFiles] = React.useState<FileWithPreview[]>([])
  const [errors, setErrors] = React.useState<string[]>([])
  const [isDragging, setIsDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const addFiles = React.useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list).slice(0, maxFiles)
      const errs: string[] = []
      const valid = incoming.filter((f) => {
        if (!matchesAccept(f, accept)) { errs.push(`Format non pris en charge : ${f.name}`); return false }
        if (f.size > maxSize) { errs.push(`${f.name} dépasse ${Math.round(maxSize / 1024 / 1024)} Mo`); return false }
        return true
      })
      setErrors(errs)
      if (!valid.length) return
      const next = valid.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      }))
      setFiles((prev) => (maxFiles === 1 ? next : [...prev, ...next].slice(0, maxFiles)))
      next.forEach((f) => onUpload?.(f.file))
    },
    [accept, maxFiles, maxSize, onUpload],
  )

  const stop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }

  return {
    files,
    errors,
    isDragging,
    handleDragEnter: (e: React.DragEvent) => { stop(e); setIsDragging(true) },
    handleDragLeave: (e: React.DragEvent) => {
      stop(e)
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
    },
    handleDragOver: stop,
    handleDrop: (e: React.DragEvent) => { stop(e); setIsDragging(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files) },
    openFileDialog: () => inputRef.current?.click(),
    removeFile: (id?: string) => {
      setFiles((prev) => prev.filter((f) => f.id !== id))
      setErrors([])
      if (inputRef.current) inputRef.current.value = ''
      onRemove?.()
    },
    setErrors,
    getInputProps: () => ({
      ref: inputRef,
      type: 'file' as const,
      accept,
      multiple: maxFiles > 1,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) addFiles(e.target.files) },
    }),
  }
}
