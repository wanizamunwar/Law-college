import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'danger'
  | 'ghost'
  | 'ghostDanger'

export type ButtonSize = 'sm' | 'md' | 'lg'

interface BaseProps {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconRight?: ReactNode
  block?: boolean
  children?: ReactNode
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn--primary',
  secondary: 'btn--secondary',
  accent: 'btn--accent',
  danger: 'btn--danger',
  ghost: 'btn--ghost',
  ghostDanger: 'btn--ghost btn--danger-ghost',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'btn--sm',
  md: '',
  lg: 'btn--lg',
}

export function buttonClass({
  variant = 'secondary',
  size = 'md',
  block = false,
}: Pick<BaseProps, 'variant' | 'size' | 'block'> = {}): string {
  return ['btn', VARIANT_CLASS[variant], SIZE_CLASS[size], block ? 'btn--block' : '']
    .filter(Boolean)
    .join(' ')
}

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { type?: 'button' | 'submit' }

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  block,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[buttonClass({ variant, size, block }), className].filter(Boolean).join(' ')}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  )
}

type ButtonLinkProps = BaseProps & {
  to: string
  className?: string
  title?: string
  'aria-label'?: string
}

export function ButtonLink({
  to,
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  block,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      to={to}
      className={[buttonClass({ variant, size, block }), className].filter(Boolean).join(' ')}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </Link>
  )
}