// Composant 21st.dev : « File Dropzone » par joyco (https://21st.dev), traduit et adapté au CV (version compacte).
import { AlertCircleIcon, FileTextIcon, LoaderCircleIcon, UploadCloudIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useFileUpload } from '@/components/ui/file-dropzone-utils/use-file-upload'
import { cn } from '@/lib/utils'

export interface FileDropzoneProps {
  accept?: string
  maxSizeMB?: number
  onUpload?: (file: File) => Promise<unknown> | void
  onRemove?: () => void
  busy?: boolean
  error?: string
  className?: string
}

const formatSize = (size: number) =>
  size < 1024 * 1024 ? `${(size / 1024).toFixed(0)} Ko` : `${(size / 1024 / 1024).toFixed(2)} Mo`

export const FileDropzone = ({ accept, maxSizeMB = 10, onUpload, onRemove, busy, error, className }: FileDropzoneProps) => {
  const {
    files,
    isDragging,
    errors,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    openFileDialog,
    removeFile,
    getInputProps,
  } = useFileUpload({ accept, maxSize: maxSizeMB * 1024 * 1024, maxFiles: 1, onUpload, onRemove })

  const uploadedFile = files[0]?.file || null
  const message = errors[0] || error

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className="border-border-strong has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-ring/20 data-[dragging=true]:border-primary data-[dragging=true]:bg-primary-soft relative flex items-center gap-3 rounded-lg border border-dashed bg-muted/40 px-3 py-2.5 transition-colors has-[input:focus-visible]:ring-[3px]"
        data-dragging={isDragging || undefined}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input {...getInputProps()} aria-label="Importer votre CV" className="sr-only" />
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-card">
          {busy ? (
            <LoaderCircleIcon className="size-4 animate-spin text-primary" />
          ) : uploadedFile ? (
            <FileTextIcon className="size-4 text-primary" />
          ) : (
            <UploadCloudIcon className="size-4 text-muted-foreground" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          {uploadedFile ? (
            <>
              <p className="truncate text-sm font-semibold">{uploadedFile.name}</p>
              <p className="text-xs text-muted-foreground">{busy ? 'Lecture du fichier…' : `${formatSize(uploadedFile.size)} · texte extrait`}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">{isDragging ? 'Déposez le fichier' : 'Glissez votre CV ici'}</p>
              <p className="text-xs text-muted-foreground">PDF ou TXT · {maxSizeMB} Mo max.</p>
            </>
          )}
        </div>
        {uploadedFile ? (
          <Button variant="ghost" size="icon-sm" aria-label="Retirer le fichier" onClick={() => removeFile(files[0]?.id)}>
            <XIcon aria-hidden="true" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={openFileDialog}>Parcourir</Button>
        )}
      </div>

      {message && (
        <div className="text-destructive flex items-center gap-1.5 text-xs font-medium" role="alert">
          <AlertCircleIcon className="size-3.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}
    </div>
  )
}

export default FileDropzone
