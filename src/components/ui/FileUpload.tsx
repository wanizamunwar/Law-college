import { useRef, useState } from 'react'
import { FileText, ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react'
import { formatBytes } from '@/lib/format'
import { MAX_DOCUMENT_BYTES } from '@/lib/documentStore'

interface FileUploadProps {
  label: string
  accept: string
  fileName: string | null
  fileSize: number | null
  previewUrl?: string | null
  required?: boolean
  hint?: string
  error?: string
  onSelect: (file: File) => void
  onClear: () => void
}

export function FileUpload({
  label,
  accept,
  fileName,
  fileSize,
  previewUrl,
  required,
  hint,
  error,
  onSelect,
  onClear,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const isFilled = Boolean(fileName)
  const isImage = Boolean(previewUrl) || Boolean(fileName && /\.(png|jpe?g|webp|gif)$/i.test(fileName))
  const displayError = localError ?? error

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset so selecting the same file twice still fires a change event.
    event.target.value = ''
    if (!file) return

    if (file.size > MAX_DOCUMENT_BYTES) {
      setLocalError(`${label} must be smaller than ${formatBytes(MAX_DOCUMENT_BYTES)}.`)
      return
    }

    setLocalError(null)
    onSelect(file)
  }

  return (
    <div className="field">
      <span className="field__label">
        {label}
        {required && (
          <span className="field__required" aria-hidden="true">
            *
          </span>
        )}
      </span>

      <div
        className={[
          'upload',
          isFilled ? 'upload--filled' : '',
          displayError ? 'upload--error' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => !isFilled && inputRef.current?.click()}
        role={isFilled ? undefined : 'button'}
        tabIndex={isFilled ? undefined : 0}
        onKeyDown={(event) => {
          if (!isFilled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="u-visually-hidden"
          aria-label={label}
        />

        {isFilled ? (
          <div className="upload__file">
            <span className="upload__file-icon">
              {previewUrl ? (
                <img src={previewUrl} alt="" />
              ) : isImage ? (
                <ImageIcon size={15} />
              ) : (
                <FileText size={15} />
              )}
            </span>
            <span className="upload__file-meta">
              <span className="upload__file-name">{fileName}</span>
              <span className="upload__file-size">
                {fileSize !== null ? formatBytes(fileSize) : 'Uploaded'}
              </span>
            </span>
            <span className="upload__actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={(event) => {
                  event.stopPropagation()
                  inputRef.current?.click()
                }}
              >
                <Paperclip size={13} />
                Replace
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--danger-ghost btn--sm"
                onClick={(event) => {
                  event.stopPropagation()
                  onClear()
                }}
                aria-label={`Remove ${label}`}
              >
                <Trash2 size={13} />
              </button>
            </span>
          </div>
        ) : (
          <>
            <span className="upload__icon">
              <Upload size={19} />
            </span>
            <span className="upload__title">Upload {label}</span>
            <span className="upload__hint">
              {hint ?? `PDF, JPG or PNG · max ${formatBytes(MAX_DOCUMENT_BYTES)}`}
            </span>
          </>
        )}
      </div>

      {displayError && (
        <span className="field__error" role="alert">
          {displayError}
        </span>
      )}
    </div>
  )
}