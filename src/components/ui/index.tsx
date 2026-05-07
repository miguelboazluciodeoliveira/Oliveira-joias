import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

// ── BADGE ──────────────────────────────────────────────────────
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'gold'

const badgeClasses: Record<BadgeVariant, string> = {
  success: 'bg-green-50 text-green-700 border-green-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger:  'bg-red-50 text-red-700 border-red-100',
  info:    'bg-blue-50 text-blue-700 border-blue-100',
  gray:    'bg-gray-50 text-gray-600 border-gray-100',
  gold:    'bg-gold-50 text-gold-700 border-gold-200',
}

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

export function Badge({ variant = 'gray', children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      badgeClasses[variant],
      className
    )}>
      {children}
    </span>
  )
}

// ── BUTTON ─────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const btnVariantClasses: Record<ButtonVariant, string> = {
  primary:      'bg-gold-500 text-dark-800 hover:bg-gold-400 border border-gold-600 font-medium',
  secondary:    'bg-white text-dark-600 hover:bg-cream-100 border border-gold-200',
  ghost:        'bg-transparent text-dark-500 hover:bg-cream-200 border border-transparent',
  danger:       'bg-red-600 text-white hover:bg-red-700 border border-red-700',
  'danger-ghost': 'bg-transparent text-red-600 hover:bg-red-50 border border-transparent',
}

const btnSizeClasses: Record<ButtonSize, string> = {
  sm:   'h-7 px-2.5 text-xs gap-1',
  md:   'h-9 px-3.5 text-sm gap-1.5',
  lg:   'h-10 px-5 text-sm gap-2',
  icon: 'h-8 w-8 p-0',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, leftIcon, rightIcon, children, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-normal',
          'transition-all duration-150 cursor-pointer select-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50',
          'active:scale-[0.98]',
          btnVariantClasses[variant],
          btnSizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 size={14} className="animate-spin flex-shrink-0" />}
        {!loading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    )
  }
)
Button.displayName = 'Button'

// ── INPUT ──────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftAddon?: ReactNode
  rightAddon?: ReactNode
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftAddon, rightAddon, wrapperClassName, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className={cn('flex flex-col gap-1', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="label-base">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <span className="absolute left-3 text-dark-300 pointer-events-none select-none">
              {leftAddon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'input-base',
              leftAddon && 'pl-8',
              rightAddon && 'pr-8',
              error && 'border-red-400 focus:border-red-400 focus:ring-red-400/30',
              className
            )}
            {...props}
          />
          {rightAddon && (
            <span className="absolute right-3 text-dark-300 pointer-events-none select-none">
              {rightAddon}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-dark-300">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

// ── SELECT ─────────────────────────────────────────────────────
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  wrapperClassName?: string
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, wrapperClassName, className, id, placeholder, children, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className={cn('flex flex-col gap-1', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="label-base">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'input-base',
            error && 'border-red-400 focus:border-red-400 focus:ring-red-400/30',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {children}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-dark-300">{hint}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'

// ── TEXTAREA ───────────────────────────────────────────────────
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  wrapperClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, wrapperClassName, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className={cn('flex flex-col gap-1', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="label-base">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'input-base resize-y min-h-[72px]',
            error && 'border-red-400',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-dark-300">{hint}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

// ── CARD ───────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md'
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div className={cn(
      'bg-white rounded-xl border border-gold-100 shadow-sm',
      padding === 'md' && 'p-5',
      padding === 'sm' && 'p-3',
      padding === 'none' && '',
      className
    )}>
      {children}
    </div>
  )
}

// ── CARD HEADER ────────────────────────────────────────────────
interface CardHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function CardHeader({ title, subtitle, actions, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <div>
        <h2 className="font-display text-lg font-medium text-dark-700">{title}</h2>
        {subtitle && <p className="text-xs text-dark-300 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// ── MODAL ──────────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const modalSizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-dark-800/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div className={cn(
        'relative w-full bg-white rounded-2xl border border-gold-100 shadow-xl',
        'flex flex-col max-h-[90vh]',
        modalSizes[size]
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gold-100 flex-shrink-0">
          <h3 className="font-display text-lg font-medium text-dark-700">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-dark-300 hover:text-dark-600 hover:bg-cream-200 transition-colors"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gold-100 flex items-center justify-end gap-2 flex-shrink-0 bg-cream-50/50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── CONFIRM DIALOG ─────────────────────────────────────────────
interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  loading?: boolean
  variant?: 'danger' | 'warning'
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = 'Confirmar', loading, variant = 'danger'
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-dark-500">{description}</p>
    </Modal>
  )
}

// ── SPINNER ────────────────────────────────────────────────────
export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn('animate-spin text-gold-500', className)} />
}

// ── EMPTY STATE ────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {icon && <div className="text-gold-300 mb-4">{icon}</div>}
      <h3 className="text-sm font-medium text-dark-500">{title}</h3>
      {description && <p className="text-xs text-dark-300 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── METRIC CARD ────────────────────────────────────────────────
interface MetricCardProps {
  label: string
  value: string | number
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  accent?: boolean
  className?: string
}

export function MetricCard({ label, value, change, changeType = 'neutral', accent, className }: MetricCardProps) {
  return (
    <Card className={cn(accent && 'border-l-4 border-l-gold-500', className)}>
      <p className="text-xs uppercase tracking-wide text-dark-300 mb-1">{label}</p>
      <p className="font-display text-2xl font-medium text-dark-700">{value}</p>
      {change && (
        <p className={cn(
          'text-xs mt-1',
          changeType === 'up' && 'text-green-600',
          changeType === 'down' && 'text-red-600',
          changeType === 'neutral' && 'text-dark-300',
        )}>
          {change}
        </p>
      )}
    </Card>
  )
}

// ── DIVIDER ────────────────────────────────────────────────────
export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-gold-100 my-4', className)} />
}

// ── PAGE HEADER ────────────────────────────────────────────────
interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h1 className="font-display text-2xl font-medium text-dark-800">{title}</h1>
        {subtitle && <p className="text-xs text-dark-300 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// ── SEARCH INPUT ───────────────────────────────────────────────
interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({ value, onChange, placeholder = 'Buscar...', className }: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <svg
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-300 pointer-events-none"
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('input-base pl-8 bg-cream-100 border-transparent focus:bg-white text-sm', className)}
      />
    </div>
  )
}
