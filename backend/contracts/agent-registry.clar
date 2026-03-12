;; agent-registry.clar
;; On-chain identity registry for ClawBot AI agents.
;; Each agent has a unique uint ID, owner principal, skills, pricing, and endpoint.

;; ---- CONSTANTS ----

(define-constant CONTRACT-OWNER tx-sender)

(define-constant ERR-NOT-AUTHORIZED    (err u100))
(define-constant ERR-AGENT-NOT-FOUND   (err u101))
(define-constant ERR-ALREADY-EXISTS    (err u102))
(define-constant ERR-INVALID-PRICE     (err u103))
(define-constant ERR-INVALID-NAME      (err u104))
(define-constant ERR-INVALID-ENDPOINT  (err u105))
(define-constant ERR-AGENT-INACTIVE    (err u106))

;; ---- DATA ----

(define-data-var next-agent-id uint u0)
(define-data-var total-agents  uint u0)

;; Primary agent storage. Key: agent-id (uint).
(define-map agents
  uint
  {
    name:        (string-ascii 64),
    description: (string-utf8 256),
    skills:      (list 10 (string-ascii 32)),
    price-ustx:  uint,
    endpoint:    (string-ascii 128),
    owner:       principal,
    active:      bool,
    created-at:  uint
  }
)

;; Secondary index: owner -> list of their agent IDs (max 20).
(define-map agent-ids-by-owner
  principal
  (list 20 uint)
)

;; ---- PRIVATE HELPERS ----

(define-private (get-agent-record (agent-id uint))
  (map-get? agents agent-id)
)

(define-private (append-agent-to-owner (owner principal) (agent-id uint))
  (let ((existing (default-to (list) (map-get? agent-ids-by-owner owner))))
    (map-set agent-ids-by-owner owner (unwrap! (as-max-len? (append existing agent-id) u20) false))
    true
  )
)

(define-private (remove-agent-from-owner-list (owner principal) (agent-id uint))
  (let ((existing (default-to (list) (map-get? agent-ids-by-owner owner))))
    (map-set agent-ids-by-owner owner
      (filter not-this-agent existing))
  )
)

;; Helper for filtering — cannot use closures, so we use a workaround via a data var.
(define-data-var agent-id-to-remove uint u0)

(define-private (not-this-agent (id uint))
  (not (is-eq id (var-get agent-id-to-remove)))
)

;; ---- PUBLIC FUNCTIONS ----

;; Register a new agent. Caller becomes the owner.
;; Returns: (ok new-agent-id)
(define-public (register-agent
    (name        (string-ascii 64))
    (description (string-utf8 256))
    (skills      (list 10 (string-ascii 32)))
    (price-ustx  uint)
    (endpoint    (string-ascii 128))
  )
  (let
    (
      (new-id (+ (var-get next-agent-id) u1))
    )
    (asserts! (> (len name) u0)     ERR-INVALID-NAME)
    (asserts! (> (len endpoint) u0) ERR-INVALID-ENDPOINT)
    (asserts! (> price-ustx u0)     ERR-INVALID-PRICE)

    (map-set agents new-id {
      name:        name,
      description: description,
      skills:      skills,
      price-ustx:  price-ustx,
      endpoint:    endpoint,
      owner:       tx-sender,
      active:      true,
      created-at:  block-height
    })

    (var-set next-agent-id new-id)
    (var-set total-agents (+ (var-get total-agents) u1))

    ;; Append agent-id to owner's list (ignore if list already full).
    (append-agent-to-owner tx-sender new-id)

    (ok new-id)
  )
)

;; Update a registered agent's mutable fields. Owner only.
;; Returns: (ok agent-id)
(define-public (update-agent
    (agent-id    uint)
    (name        (string-ascii 64))
    (description (string-utf8 256))
    (skills      (list 10 (string-ascii 32)))
    (price-ustx  uint)
    (endpoint    (string-ascii 128))
  )
  (let ((agent (unwrap! (get-agent-record agent-id) ERR-AGENT-NOT-FOUND)))
    (asserts! (is-eq tx-sender (get owner agent)) ERR-NOT-AUTHORIZED)
    (asserts! (> (len name) u0)     ERR-INVALID-NAME)
    (asserts! (> (len endpoint) u0) ERR-INVALID-ENDPOINT)
    (asserts! (> price-ustx u0)     ERR-INVALID-PRICE)

    (map-set agents agent-id (merge agent {
      name:        name,
      description: description,
      skills:      skills,
      price-ustx:  price-ustx,
      endpoint:    endpoint
    }))
    (ok agent-id)
  )
)

;; Set an agent's active status. Owner only.
;; Returns: (ok new-active-bool)
(define-public (set-agent-active (agent-id uint) (active bool))
  (let ((agent (unwrap! (get-agent-record agent-id) ERR-AGENT-NOT-FOUND)))
    (asserts! (is-eq tx-sender (get owner agent)) ERR-NOT-AUTHORIZED)
    (map-set agents agent-id (merge agent { active: active }))
    (ok active)
  )
)

;; Transfer agent ownership to a new principal. Current owner only.
;; Returns: (ok agent-id)
(define-public (transfer-agent-ownership (agent-id uint) (new-owner principal))
  (let ((agent (unwrap! (get-agent-record agent-id) ERR-AGENT-NOT-FOUND)))
    (asserts! (is-eq tx-sender (get owner agent)) ERR-NOT-AUTHORIZED)

    ;; Update secondary index: remove from old owner, add to new owner.
    (var-set agent-id-to-remove agent-id)
    (remove-agent-from-owner-list tx-sender agent-id)
    (append-agent-to-owner new-owner agent-id)

    (map-set agents agent-id (merge agent { owner: new-owner }))
    (ok agent-id)
  )
)

;; ---- READ-ONLY FUNCTIONS ----

(define-read-only (get-agent (agent-id uint))
  (map-get? agents agent-id)
)

(define-read-only (get-total-agents)
  (var-get total-agents)
)

(define-read-only (get-next-agent-id)
  (var-get next-agent-id)
)

(define-read-only (get-agent-price (agent-id uint))
  (match (map-get? agents agent-id)
    agent (ok (get price-ustx agent))
    ERR-AGENT-NOT-FOUND
  )
)

(define-read-only (is-agent-active (agent-id uint))
  (match (map-get? agents agent-id)
    agent (ok (get active agent))
    ERR-AGENT-NOT-FOUND
  )
)

(define-read-only (get-agents-by-owner (owner principal))
  (default-to (list) (map-get? agent-ids-by-owner owner))
)
