import type {
  ButtonHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  InputHTMLAttributes
} from 'react'
import './ui.css'

// ---------- Button ----------

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...rest
}: ButtonProps): JSX.Element {
  return <button className={`ui-btn ${variant} ${size} ${className}`} {...rest} />
}

// ---------- Chip (toggle) ----------

export function Chip({
  active = false,
  children,
  onClick
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
}): JSX.Element {
  return (
    <button type="button" className={`ui-chip ${active ? 'on' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

// ---------- Field wrapper ----------

export function Field({
  label,
  children,
  hint
}: {
  label: string
  hint?: string
  children: ReactNode
}): JSX.Element {
  return (
    <label className="ui-field">
      <span className="ui-field-label">{label}</span>
      {children}
      {hint && <span className="ui-field-hint">{hint}</span>}
    </label>
  )
}

// ---------- Inputs ----------

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  const { className = '', ...rest } = props
  return <textarea className={`ui-input ui-textarea ${className}`} {...rest} />
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  const { className = '', ...rest } = props
  return <input className={`ui-input ${className}`} {...rest} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  const { className = '', ...rest } = props
  return <select className={`ui-input ui-select ${className}`} {...rest} />
}

// ---------- Card ----------

export function Card({
  children,
  className = '',
  onClick
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}): JSX.Element {
  return (
    <div className={`ui-card ${onClick ? 'clickable' : ''} ${className}`} onClick={onClick}>
      {children}
    </div>
  )
}

// ---------- Pane header ----------

export function PaneHeader({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}): JSX.Element {
  return (
    <div className="ui-pane-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ui-pane-actions">{actions}</div>}
    </div>
  )
}

// ---------- Empty state ----------

export function EmptyState({
  title,
  hint,
  action
}: {
  title: string
  hint?: string
  action?: ReactNode
}): JSX.Element {
  return (
    <div className="ui-empty">
      <div className="ui-empty-title">{title}</div>
      {hint && <div className="ui-empty-hint">{hint}</div>}
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  )
}

// ---------- Badge ----------

export function Badge({
  children,
  tone = 'neutral'
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'danger' | 'success' | 'warn'
}): JSX.Element {
  return <span className={`ui-badge ${tone}`}>{children}</span>
}
