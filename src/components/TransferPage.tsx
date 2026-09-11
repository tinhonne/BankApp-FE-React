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
    } else if (source && typeof source.balance === 'number' && value > source.balance) {
      errors.amount = `Amount exceeds available balance (${formatMoney(source.balance)}).`
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
  const [lastTransfer, setLastTransfer] = useState<Transaction | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [refreshAccountsKey, setRefreshAccountsKey] = useState(0)
  const abortController = useRef<AbortController | null>(null)

  useEffect(() => () => abortController.current?.abort(), [])

  function handleStartReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    const errors = validate(source, destination, amount, content)
    setFieldErrors(errors)
    setFormError('')

    if (Object.keys(errors).length > 0) {
      return
    }

    if (!source || !destination || !source.accountNumber || !destination.accountNumber) {
      return
    }

    setShowReviewModal(true)
  }

  async function handleConfirmTransfer() {
    if (isSubmitting || !source || !destination || !source.accountNumber || !destination.accountNumber) {
      return
    }

    const controller = new AbortController()
    abortController.current = controller
    setIsSubmitting(true)
    setFormError('')

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
      setShowReviewModal(false)

      if (result.status === 'SUCCESS') {
        setRefreshAccountsKey((key) => key + 1)
      } else {
        setFormError(
          `The transfer could not be completed: ${result.errorReason ?? result.status}. The transaction was recorded with status "${result.status}".`,
        )
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      setShowReviewModal(false)
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

  function handleReset() {
    setSource(null)
    setDestination(null)
    setAmount('')
    setContent('')
    setFieldErrors({})
    setFormError('')
    setLastTransfer(null)
    setShowReviewModal(false)
  }

  return (
    <main className="dashboard-page">
      <PageHeader session={session} onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="page-titlebar">
          <div>
            <p className="eyebrow">Financial Operations</p>
            <h1>Transfer funds</h1>
          </div>
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => navigate('/accounts')}>
              Back to accounts
            </button>
          </div>
        </div>

        {lastTransfer && lastTransfer.status === 'SUCCESS' ? (
          <section className="receipt-card" aria-label="Transfer Confirmation Receipt">
            <div className="receipt-header">
              <div className="receipt-success-icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2>Transfer successful</h2>
              <p className="receipt-subtitle">The funds have been transferred successfully.</p>
              <div className="receipt-amount tabular-nums">
                {formatMoney(lastTransfer.amount)}
              </div>
            </div>

            <div className="receipt-details">
              <div className="receipt-row">
                <span>Transaction ID</span>
                <strong className="tabular-nums">#{lastTransfer.id}</strong>
              </div>
              <div className="receipt-row">
                <span>Execution date</span>
                <span className="tabular-nums">{formatDateTime(lastTransfer.transactionDate)}</span>
              </div>
              <div className="receipt-row">
                <span>Source account</span>
                <strong className="account-num tabular-nums">{lastTransfer.fromAccountNumber}</strong>
              </div>
              <div className="receipt-row">
                <span>Destination account</span>
                <strong className="account-num tabular-nums">{lastTransfer.toAccountNumber}</strong>
              </div>
              {lastTransfer.content && (
                <div className="receipt-row">
                  <span>Transfer memo</span>
                  <span>{lastTransfer.content}</span>
                </div>
              )}
              <div className="receipt-row">
                <span>Transfer fee</span>
                <span className="receipt-fee-free">0.00 (Free)</span>
              </div>
            </div>

            <div className="receipt-actions">
              <button type="button" className="btn btn-primary" onClick={handleReset}>
                New transfer
              </button>
              {lastTransfer.fromAccountNumber && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate(`/transactions/history/${lastTransfer.fromAccountNumber}`)}
                >
                  View transaction history
                </button>
              )}
            </div>
          </section>
        ) : (
          <form className="detail-card customer-form" noValidate onSubmit={handleStartReview}>
            <div className="form-grid">
              <div className="form-field">
                <label>From account (Source)</label>
                <AccountSearchSelect
                  value={source}
                  onChange={(account) => {
                    setSource(account)
                    setFieldErrors((current) => ({ ...current, source: undefined }))
                    setFormError('')
                  }}
                  onUnauthorized={onUnauthorized}
                  disabled={isSubmitting}
                  excludeAccountNumber={destination?.accountNumber ?? undefined}
                  refreshKey={refreshAccountsKey}
                />
                {source && typeof source.balance === 'number' && (
                  <span className="field-hint">
                    Available balance: <strong className="tabular-nums">{formatMoney(source.balance)}</strong>
                  </span>
                )}
                {fieldErrors.source && <span className="field-error">{fieldErrors.source}</span>}
              </div>

              <div className="form-field">
                <label>To account (Destination)</label>
                <AccountSearchSelect
                  value={destination}
                  onChange={(account) => {
                    setDestination(account)
                    setFieldErrors((current) => ({ ...current, destination: undefined }))
                    setFormError('')
                  }}
                  onUnauthorized={onUnauthorized}
                  disabled={isSubmitting}
                  excludeAccountNumber={source?.accountNumber ?? undefined}
                  refreshKey={refreshAccountsKey}
                />
                {destination && destination.customerName && (
                  <span className="field-hint">
                    Beneficiary: <strong>{destination.customerName}</strong>
                  </span>
                )}
                {fieldErrors.destination && <span className="field-error">{fieldErrors.destination}</span>}
              </div>

              <div className="form-field">
                <label htmlFor="transfer-amount">Amount</label>
                <div className="amount-input-wrapper">
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
                    }}
                  />
                </div>
                <span className="field-hint">Minimum required: {MINIMUM_AMOUNT.toLocaleString('en-US')}</span>
                {fieldErrors.amount && <span className="field-error">{fieldErrors.amount}</span>}
              </div>

              <div className="form-field">
                <label htmlFor="transfer-content">Content / Memo (optional)</label>
                <input
                  id="transfer-content"
                  type="text"
                  maxLength={255}
                  value={content}
                  disabled={isSubmitting}
                  placeholder="e.g. Invoice payment, monthly allowance"
                  aria-invalid={Boolean(fieldErrors.content)}
                  onChange={(event) => {
                    setContent(event.target.value)
                    setFieldErrors((current) => ({ ...current, content: undefined }))
                    setFormError('')
                  }}
                />
                <span className="field-hint">{content.length}/255 characters</span>
                {fieldErrors.content && <span className="field-error">{fieldErrors.content}</span>}
              </div>
            </div>

            {formError && (
              <div className="form-error" role="alert">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{formError}</span>
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                Review transfer
              </button>
              <button
                type="button"
                className="btn"
                disabled={isSubmitting}
                onClick={handleReset}
              >
                Reset
              </button>
            </div>
          </form>
        )}

        {showReviewModal && source && destination && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
            <div className="modal-panel">
              <div className="modal-header">
                <h2 id="review-modal-title">Review transfer details</h2>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowReviewModal(false)}
                  disabled={isSubmitting}
                  aria-label="Close review dialog"
                >
                  ✕
                </button>
              </div>

              <div className="review-summary">
                <div className="review-amount-box">
                  <span>Transfer amount</span>
                  <strong className="tabular-nums">{formatMoney(Number(amount))}</strong>
                </div>

                <div className="review-grid">
                  <div className="review-item">
                    <span>Source Account</span>
                    <strong className="account-num tabular-nums">{source.accountNumber}</strong>
                    <small>{source.customerName ?? 'Source Account Holder'}</small>
                  </div>

                  <div className="review-item">
                    <span>Destination Account</span>
                    <strong className="account-num tabular-nums">{destination.accountNumber}</strong>
                    <small>{destination.customerName ?? 'Destination Account Holder'}</small>
                  </div>

                  <div className="review-item">
                    <span>Transfer Fee</span>
                    <strong className="receipt-fee-free">0.00 (No fee)</strong>
                  </div>

                  <div className="review-item">
                    <span>Total Debit</span>
                    <strong className="tabular-nums">{formatMoney(Number(amount))}</strong>
                  </div>

                  <div className="review-item review-item-full">
                    <span>Memo / Content</span>
                    <p>{content.trim() || '— (No memo provided)'}</p>
                  </div>
                </div>

                <div className="review-security-notice">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Transfers between active accounts are processed immediately upon confirmation.</span>
                </div>
              </div>

              {formError && (
                <div className="form-error" role="alert">
                  <span>{formError}</span>
                </div>
              )}

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowReviewModal(false)}
                  disabled={isSubmitting}
                >
                  Edit details
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleConfirmTransfer()}
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? 'Processing transfer…' : 'Confirm & Transfer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}