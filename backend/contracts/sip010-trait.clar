;; sip010-trait.clar
;; SIP-010 Fungible Token Standard Trait
;; https://github.com/stacksgov/sips/blob/main/sips/sip-010/sip-010-fungible-token-standard.md

(define-trait sip010-ft-trait
  (
    ;; Transfer `amount` tokens from `sender` to `recipient`.
    ;; Must be called by `sender` (tx-sender == sender).
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))

    ;; Get human-readable token name.
    (get-name () (response (string-ascii 32) uint))

    ;; Get token ticker symbol.
    (get-symbol () (response (string-ascii 32) uint))

    ;; Get number of decimal places (6 for USDCx).
    (get-decimals () (response uint uint))

    ;; Get token balance of `who`.
    (get-balance (principal) (response uint uint))

    ;; Get current total circulating supply.
    (get-total-supply () (response uint uint))

    ;; Get optional URI pointing to token metadata.
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)
