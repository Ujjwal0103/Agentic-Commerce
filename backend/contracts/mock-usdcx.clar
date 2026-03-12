;; mock-usdcx.clar
;; Mock USDCx SIP-010 fungible token for devnet/testnet development.
;; 6 decimals — 1 USDCx = 1,000,000 micro-units.
;; Replace with the real USDCx contract address on mainnet.

(impl-trait .sip010-trait.sip010-ft-trait)

(define-fungible-token mock-usdcx)

(define-constant CONTRACT-OWNER tx-sender)
(define-constant TOKEN-NAME "Mock USDCx")
(define-constant TOKEN-SYMBOL "USDCx")
(define-constant TOKEN-DECIMALS u6)
(define-constant TOKEN-URI (some u"https://agentcommerce.network/mock-usdcx.json"))

(define-constant ERR-NOT-AUTHORIZED (err u1))
(define-constant ERR-TRANSFER-FAILED (err u2))

;; ---- SIP-010 TRAIT IMPLEMENTATION ----

(define-public (transfer
    (amount    uint)
    (sender    principal)
    (recipient principal)
    (memo      (optional (buff 34)))
  )
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
    (try! (ft-transfer? mock-usdcx amount sender recipient))
    (match memo m (print m) true)
    (ok true)
  )
)

(define-read-only (get-name)
  (ok TOKEN-NAME)
)

(define-read-only (get-symbol)
  (ok TOKEN-SYMBOL)
)

(define-read-only (get-decimals)
  (ok TOKEN-DECIMALS)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance mock-usdcx account))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply mock-usdcx))
)

(define-read-only (get-token-uri)
  (ok TOKEN-URI)
)

;; ---- MINT (deployer only) ----

(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ft-mint? mock-usdcx amount recipient)
  )
)

;; ---- BURN (self only) ----

(define-public (burn (amount uint))
  (ft-burn? mock-usdcx amount tx-sender)
)
