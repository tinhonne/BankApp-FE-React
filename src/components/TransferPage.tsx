import { useEffect, useRef, useState, type FormEvent } from 'react'
import { HttpError, validationErrors, type ValidationError } from '../api/http'
import { transfer } from '../api/transactions'
import type { Account, Transaction } from '../api/types'
import type { Session } from '../auth/session'
import { formatMoney } from '../lib/accountStatus'
import { formatDateTime } from '../lib/transactionStatus'
import { navigate } from '../lib/navigate'
import AccountSearchSelect from './AccountSearchSelect'
import PageHeader from './PageHeader'

const MINIMUM_AMOUNT = 1000

type FieldErrors = {
  source?: string
  destination?: string
  amount?: string
  content?: string
}

const REASON_MESSAGES: Record<string, string> = {
  NOT_BLANK: 'This field is required.',
  NOT_NULL: 'This field is required.',
  SIZE: 'Value is too long.',
  PATTERN: 'The format is invalid.',
  DECIMAL_MIN: 'Amount is below the minimum.',
  DIGITS: 'Amount must have at most 2 decimal places.',
}

function applyServerErrors(errors: ValidationError[]): FieldErrors {
  const result: FieldErrors = {}
  for (const error of errors) {
    if (!error.field || result[error.field as keyof FieldErrors]) {
      continue
    }
    result[error.field as keyof FieldErrors] = REASON_MESSAGES[error.reason] ?? 'This value is invalid.'
  }
  return result
}

function validate(
  source: Account | null,
  destination: Account | null,
  amountText: string,
  content: string,
) {
  const errors: FieldErrors = {}

  if (!source) {
    errors.source = 'Select a source account.'
  }
  if (!destination) {
    errors.destination = 'Select a destination account.'
  } else if (source && destination && source.accountNumber === destination.accountNumber) {
    errors.destination = 'Source and destination accounts must be different.'
  }
  if (!amountText) {
    errors.amount = 'Amount is required.'
  } else if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
    errors.amount = 'Amount must be a number with up to 2 decimal places.'
  } else {
    const value = Number(amountText)
    if (!Number.isFinite(value) || value < MINIMUM_AMOUNT) {
      errors.amount = `Amount must be at least ${MINIMUM_AMOUNT.toLocaleString('en-US')}.`
    }
  }
  if (content.length > 255) {
    errors.content = 'Content must be 255 characters or fewer.'
  }

  return errors
}

type TransferPageProps = {
  session: Session
  onUnauthorized: () => void
  onLogout: () => void
}

export default function TransferPage({ session, onUnauthorized, onLogout }: TransferPageProps) {
  const [source, setSource] = useState<Account | null>(null)
  const [destination, setDestination] = useState<Account | null>(null)
  const [amount, setAmount] = useState('')
  const [content, setContent] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [lastTransfer, setLastTransfer] = useState<Transaction | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [refreshAccountsKey, setRefreshAccountsKey] = useState(0)
  const abortController = useRef<AbortController | null>(null)

  useEffect(() => () => abortController.current?.abort(), [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const errors = validate(source, destination, amount, content)
    setFieldErrors(errors)
    setFormError('')

    if (Object.keys(errors).length > 0) {
      return
    }

    if (!source || !destination || !source.accountNumber || !destination.accountNumber) {
      return
    }

    const controller = new AbortController()
    abortController.current = controller
    setIsSubmitting(true)

    try {
      const result = await transfer(
        {
          fromAccountNumber: source.accountNumber,
          toAccountNumber: destination.accountNumber,
          amount: Number(amount),
          content: content.trim() || undefined,
        },
        controller.signal,
      )
      setLastTransfer(result)

      if (result.status === 'SUCCESS') {
        setSuccessMessage(
          `Transfer of ${formatMoney(result.amount)} from ${result.fromAccountNumber} to ${result.toAccountNumber} was successful.`,
        )
        setAmount('')
        setContent('')
        setSource(null)
        setDestination(null)
        setRefreshAccountsKey((key) => key + 1)
      } else {
        setSuccessMessage('')
        setFormError(
          `The transfer could not be completed: ${result.errorReason ?? result.status}. The transaction was recorded with status "${result.status}".`,
        )
        setAmount('')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      if (error instanceof HttpError) {
        if (error.status === 401) {
          onUnauthorized()
          return
        }
        if (error.code === 'INVALID_INPUT') {
          const serverErrors = validationErrors(error)
          if (serverErrors.length > 0) {
            setFieldErrors(applyServerErrors(serverErrors))
            setFormError('Please review the highlighted fields.')
          } else {
            setFormError(error.message)
          }
        } else if (error.code === 'SAME_ACCOUNT_TRANSFER') {
          setFieldErrors((current) => ({
            ...current,
            destination: 'Source and destination accounts must be different.',
          }))
        } else if (error.code === 'INVALID_TRANSFER_AMOUNT') {
          setFieldErrors((current) => ({
            ...current,
            amount: `Amount must be at least ${MINIMUM_AMOUNT.toLocaleString('en-US')}.`,
          }))
        } else if (error.code === 'SOURCE_ACCOUNT_NOT_FOUND' || error.code === 'SOURCE_ACCOUNT_INACTIVE') {
          setFieldErrors((current) => ({
            ...current,
            source: 'The source account is not available for transfer.',
          }))
        } else if (error.code === 'DESTINATION_ACCOUNT_NOT_FOUND' || error.code === 'DESTINATION_ACCOUNT_INACTIVE') {
          setFieldErrors((current) => ({
            ...current,
            destination: 'The destination account is not available for transfer.',
          }))
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError('Unable to complete the transfer. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
      abortController.current = null
    }
  }

  return (
    <main className="dashboard-page">
      <PageHeader session={session} onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="page-titlebar">
          <div>
            <p className="eyebrow">Transactions</p>
            <h1>Transfer funds</h1>
          </div>
          <button type="button" className="btn" onClick={() => navigate('/accounts')}>Back to accounts</button>
        </div>

        {successMessage && (
          <div className="success-banner" role="status">
            {successMessage}
            {lastTransfer && lastTransfer.transactionDate && (
              <small>{formatDateTime(lastTransfer.transactionDate)}</small>
            )}
          </div>
        )}

        <form className="detail-card customer-form" noValidate onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label>From account</label>
              <AccountSearchSelect
                value={source}
                onChange={(account) => {
                  setSource(account)
                  setFieldErrors((current) => ({ ...current, source: undefined }))
                  setFormError('')
                  setSuccessMessage('')
                }}
                onUnauthorized={onUnauthorized}
                disabled={isSubmitting}
                excludeAccountNumber={destination?.accountNumber ?? undefined}
                refreshKey={refreshAccountsKey}
              />
              {fieldErrors.source && <span className="field-error">{fieldErrors.source}</span>}
            </div>
            <div className="form-field">
              <label>To account</label>
              <AccountSearchSelect
                value={destination}
                onChange={(account) => {
                  setDestination(account)
                  setFieldErrors((current) => ({ ...current, destination: undefined }))
                  setFormError('')
                  setSuccessMessage('')
                }}
                onUnauthorized={onUnauthorized}
                disabled={isSubmitting}
                excludeAccountNumber={source?.accountNumber ?? undefined}
                refreshKey={refreshAccountsKey}
              />
              {fieldErrors.destination && <span className="field-error">{fieldErrors.destination}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="transfer-amount">Amount</label>
              <input
                id="transfer-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                disabled={isSubmitting}
                placeholder={`Minimum ${MINIMUM_AMOUNT.toLocaleString('en-US')}`}
                aria-invalid={Boolean(fieldErrors.amount)}
                onChange={(event) => {
                  setAmount(event.target.value)
                  setFieldErrors((current) => ({ ...current, amount: undefined }))
                  setFormError('')
                  setSuccessMessage('')
                }}
              />
              {fieldErrors.amount && <span className="field-error">{fieldErrors.amount}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="transfer-content">Content (optional)</label>
              <input
                id="transfer-content"
                type="text"
                maxLength={255}
                value={content}
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.content)}
                onChange={(event) => {
                  setContent(event.target.value)
                  setFieldErrors((current) => ({ ...current, content: undefined }))
                  setFormError('')
                  setSuccessMessage('')
                }}
              />
              {fieldErrors.content && <span className="field-error">{fieldErrors.content}</span>}
            </div>
          </div>

          {formError && (
            <div className="form-error" role="alert">
              {formError}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? 'Transferring…' : 'Transfer'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={isSubmitting}
              onClick={() => {
                setSource(null)
                setDestination(null)
                setAmount('')
                setContent('')
                setFieldErrors({})
                setFormError('')
                setSuccessMessage('')
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}