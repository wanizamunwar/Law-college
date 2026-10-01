import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { AlertCircle } from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Field wrapper                                                      */
/* ------------------------------------------------------------------ */

interface FieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: FieldProps) {
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="field__required" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <span className="field__error" role="alert">
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Text input                                                         */
/* ------------------------------------------------------------------ */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Omit the label entirely when using the control inside a toolbar. */
  label?: string
  error?: string
  hint?: string
  wrapperClassName?: string
}

export function Input({
  label,
  error,
  hint,
  required,
  className,
  wrapperClassName,
  id,
  ...rest
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  const control = (
    <input
      id={inputId}
      className={['input', error ? 'input--error' : '', className].filter(Boolean).join(' ')}
      aria-invalid={error ? true : undefined}
      required={required}
      {...rest}
    />
  )

  if (!label) return control

  return (
    <Field
      label={label}
      htmlFor={inputId}
      required={required}
      hint={hint}
      error={error}
      className={wrapperClassName}
    >
      {control}
    </Field>
  )
}

/* ------------------------------------------------------------------ */
/* Select                                                             */
/* ------------------------------------------------------------------ */

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Omit the label entirely when using the control inside a toolbar. */
  label?: string
  error?: string
  hint?: string
  options: Array<{ value: string; label: string; disabled?: boolean }>
  placeholder?: string
  wrapperClassName?: string
}

export function Select({
  label,
  error,
  hint,
  options,
  placeholder,
  required,
  className,
  wrapperClassName,
  id,
  ...rest
}: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  const control = (
    <select
      id={selectId}
      className={['select', error ? 'select--error' : '', className].filter(Boolean).join(' ')}
      aria-invalid={error ? true : undefined}
      required={required}
      {...rest}
    >
      {placeholder !== undefined && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  )

  if (!label) return control

  return (
    <Field
      label={label}
      htmlFor={selectId}
      required={required}
      hint={hint}
      error={error}
      className={wrapperClassName}
    >
      {control}
    </Field>
  )
}

/* ------------------------------------------------------------------ */
/* Textarea                                                           */
/* ------------------------------------------------------------------ */

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hint?: string
  wrapperClassName?: string
}

export function Textarea({
  label,
  error,
  hint,
  required,
  className,
  wrapperClassName,
  id,
  rows = 3,
  ...rest
}: TextareaProps) {
  const generatedId = useId()
  const textareaId = id ?? generatedId

  return (
    <Field
      label={label}
      htmlFor={textareaId}
      required={required}
      hint={hint}
      error={error}
      className={wrapperClassName}
    >
      <textarea
        id={textareaId}
        rows={rows}
        className={['textarea', error ? 'textarea--error' : '', className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        required={required}
        {...rest}
      />
    </Field>
  )
}

/* ------------------------------------------------------------------ */
/* Password input with visibility toggle                              */
/* ------------------------------------------------------------------ */

import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  error?: string
  hint?: string
  wrapperClassName?: string
}

export function PasswordInput({
  label,
  error,
  hint,
  required,
  className,
  wrapperClassName,
  id,
  ...rest
}: PasswordInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [visible, setVisible] = useState(false)

  return (
    <Field
      label={label}
      htmlFor={inputId}
      required={required}
      hint={hint}
      error={error}
      className={wrapperClassName}
    >
      <div className="password-field">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={['input', error ? 'input--error' : '', className].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          required={required}
          {...rest}
        />
        <button
          type="button"
          className="password-field__toggle"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </Field>
  )
}

/* ------------------------------------------------------------------ */
/* Radio choice group                                                 */
/* ------------------------------------------------------------------ */

interface ChoiceGroupProps<T extends string> {
  label: string
  value: T | ''
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
  error?: string
  required?: boolean
  className?: string
}

export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
  required,
  className,
}: ChoiceGroupProps<T>) {
  const generatedId = useId()

  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <span className="field__label">
        {label}
        {required && (
          <span className="field__required" aria-hidden="true">
            *
          </span>
        )}
      </span>
      <div className="choice-group" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const active = value === option.value
          const inputId = `${generatedId}-${option.value}`
          return (
            <label
              key={option.value}
              htmlFor={inputId}
              className={['choice', active ? 'choice--active' : ''].filter(Boolean).join(' ')}
            >
              <input
                id={inputId}
                type="radio"
                name={generatedId}
                value={option.value}
                checked={active}
                onChange={() => onChange(option.value)}
              />
              <span className="choice__dot" aria-hidden="true" />
              {option.label}
            </label>
          )
        })}
      </div>
      {error && (
        <span className="field__error" role="alert">
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Search input                                                       */
/* ------------------------------------------------------------------ */

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
  className,
}: SearchInputProps) {
  return (
    <div className={['search-input', className].filter(Boolean).join(' ')}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {value && (
        <button
          type="button"
          className="search-input__clear"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}