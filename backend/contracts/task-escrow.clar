;; task-escrow.clar
;; Programmable escrow for AI agent task payments using USDCx (SIP-010).
;; The contract holds payment until the task is complete, then releases to the agent owner.
;; The API server's hot wallet (contract deployer) drives status transitions.

(use-trait sip010-ft-trait .sip010-trait.sip010-ft-trait)

;; ---- TASK STATUS CONSTANTS ----

(define-constant TASK-STATUS-PENDING    u0) ;; payment locked, awaiting pickup
(define-constant TASK-STATUS-PROCESSING u1) ;; API server is executing the task
(define-constant TASK-STATUS-COMPLETED  u2) ;; result delivered, funds released
(define-constant TASK-STATUS-DISPUTED   u3) ;; client filed dispute
(define-constant TASK-STATUS-REFUNDED   u4) ;; funds returned to client
(define-constant TASK-STATUS-CANCELLED  u5) ;; cancelled before processing

;; ---- ERROR CODES ----

(define-constant ERR-NOT-AUTHORIZED         (err u200))
(define-constant ERR-TASK-NOT-FOUND         (err u201))
(define-constant ERR-INVALID-STATUS         (err u202))
(define-constant ERR-AGENT-NOT-FOUND        (err u203))
(define-constant ERR-AGENT-INACTIVE         (err u204))
(define-constant ERR-TRANSFER-FAILED        (err u205))
(define-constant ERR-ALREADY-PROCESSED      (err u206))
(define-constant ERR-DISPUTE-WINDOW-CLOSED  (err u207))
(define-constant ERR-NOT-OWNER              (err u208))
(define-constant ERR-INVALID-AMOUNT         (err u209))

;; ---- DATA ----

(define-constant CONTRACT-OWNER tx-sender)

(define-data-var next-task-id           uint u0)
;; Dispute window: ~72 hours at ~10-min blocks = 432 blocks.
(define-data-var dispute-window-blocks  uint u432)

;; Primary task storage.
(define-map tasks
  uint
  {
    client:      principal,
    agent-id:    uint,
    amount-ustx: uint,
    status:      uint,
    created-at:  uint,
    updated-at:  uint,
    prompt-hash: (buff 32),
    result-hash: (optional (buff 32))
  }
)

;; Client -> list of task IDs (max 50).
(define-map tasks-by-client principal (list 50 uint))

;; Agent ID -> list of task IDs (max 100).
(define-map tasks-by-agent uint (list 100 uint))

;; Per-agent task counts (for reputation queries).
(define-map agent-task-counts
  uint
  { total: uint, completed: uint, disputed: uint, refunded: uint }
)

;; ---- PRIVATE HELPERS ----

(define-private (get-task-record (task-id uint))
  (map-get? tasks task-id)
)

(define-private (append-to-client-tasks (client principal) (task-id uint))
  (let ((existing (default-to (list) (map-get? tasks-by-client client))))
    (match (as-max-len? (append existing task-id) u50)
      new-list (map-set tasks-by-client client new-list)
      false
    )
  )
)

(define-private (append-to-agent-tasks (agent-id uint) (task-id uint))
  (let ((existing (default-to (list) (map-get? tasks-by-agent agent-id))))
    (match (as-max-len? (append existing task-id) u100)
      new-list (map-set tasks-by-agent agent-id new-list)
      false
    )
  )
)

(define-private (increment-agent-total (agent-id uint))
  (let ((counts (default-to { total: u0, completed: u0, disputed: u0, refunded: u0 }
                             (map-get? agent-task-counts agent-id))))
    (map-set agent-task-counts agent-id (merge counts { total: (+ (get total counts) u1) }))
  )
)

(define-private (increment-agent-completed (agent-id uint))
  (let ((counts (default-to { total: u0, completed: u0, disputed: u0, refunded: u0 }
                             (map-get? agent-task-counts agent-id))))
    (map-set agent-task-counts agent-id (merge counts { completed: (+ (get completed counts) u1) }))
  )
)

(define-private (increment-agent-disputed (agent-id uint))
  (let ((counts (default-to { total: u0, completed: u0, disputed: u0, refunded: u0 }
                             (map-get? agent-task-counts agent-id))))
    (map-set agent-task-counts agent-id (merge counts { disputed: (+ (get disputed counts) u1) }))
  )
)

(define-private (increment-agent-refunded (agent-id uint))
  (let ((counts (default-to { total: u0, completed: u0, disputed: u0, refunded: u0 }
                             (map-get? agent-task-counts agent-id))))
    (map-set agent-task-counts agent-id (merge counts { refunded: (+ (get refunded counts) u1) }))
  )
)

;; ---- PUBLIC FUNCTIONS ----

;; Create a task and lock USDCx in escrow.
;; The caller (client) transfers `amount-ustx` USDCx to this contract.
;; Returns: (ok new-task-id)
(define-public (create-task
    (agent-id    uint)
    (amount-ustx uint)
    (prompt-hash (buff 32))
    (usdcx-token <sip010-ft-trait>)
  )
  (let
    (
      (new-id (+ (var-get next-task-id) u1))
      (agent  (unwrap! (contract-call? .agent-registry get-agent agent-id) ERR-AGENT-NOT-FOUND))
    )
    (asserts! (get active agent)  ERR-AGENT-INACTIVE)
    (asserts! (> amount-ustx u0)  ERR-INVALID-AMOUNT)

    ;; Transfer USDCx from client to this contract (held as contract principal).
    (try! (contract-call? usdcx-token transfer
      amount-ustx
      tx-sender
      (as-contract tx-sender)
      none
    ))

    (map-set tasks new-id {
      client:      tx-sender,
      agent-id:    agent-id,
      amount-ustx: amount-ustx,
      status:      TASK-STATUS-PENDING,
      created-at:  block-height,
      updated-at:  block-height,
      prompt-hash: prompt-hash,
      result-hash: none
    })

    (var-set next-task-id new-id)
    (append-to-client-tasks tx-sender new-id)
    (append-to-agent-tasks agent-id new-id)
    (increment-agent-total agent-id)

    ;; Notify reputation contract.
    (try! (contract-call? .reputation update-task-stats agent-id TASK-STATUS-PENDING))

    (ok new-id)
  )
)

;; Mark a task as processing. API server hot wallet only.
;; Returns: (ok task-id)
(define-public (mark-processing (task-id uint))
  (let ((task (unwrap! (get-task-record task-id) ERR-TASK-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER)           ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get status task) TASK-STATUS-PENDING) ERR-INVALID-STATUS)

    (map-set tasks task-id (merge task {
      status:     TASK-STATUS-PROCESSING,
      updated-at: block-height
    }))
    (ok task-id)
  )
)

;; Complete a task: record result hash and release USDCx to the agent owner.
;; API server hot wallet only.
;; Returns: (ok task-id)
(define-public (complete-task
    (task-id     uint)
    (result-hash (buff 32))
    (usdcx-token <sip010-ft-trait>)
  )
  (let
    (
      (task       (unwrap! (get-task-record task-id) ERR-TASK-NOT-FOUND))
      (agent-id   (get agent-id task))
      (agent      (unwrap! (contract-call? .agent-registry get-agent agent-id) ERR-AGENT-NOT-FOUND))
      (agent-owner (get owner agent))
    )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get status task) TASK-STATUS-PROCESSING) ERR-INVALID-STATUS)

    ;; Release USDCx from escrow to agent owner.
    (try! (as-contract (contract-call? usdcx-token transfer
      (get amount-ustx task)
      tx-sender
      agent-owner
      none
    )))

    (map-set tasks task-id (merge task {
      status:      TASK-STATUS-COMPLETED,
      updated-at:  block-height,
      result-hash: (some result-hash)
    }))

    (increment-agent-completed agent-id)

    ;; Notify reputation contract.
    (try! (contract-call? .reputation update-task-stats agent-id TASK-STATUS-COMPLETED))

    (ok task-id)
  )
)

;; Client files a dispute on a completed task (within dispute window).
;; Returns: (ok task-id)
(define-public (dispute-task (task-id uint))
  (let ((task (unwrap! (get-task-record task-id) ERR-TASK-NOT-FOUND)))
    (asserts! (is-eq tx-sender (get client task))             ERR-NOT-OWNER)
    (asserts! (is-eq (get status task) TASK-STATUS-COMPLETED) ERR-INVALID-STATUS)
    (asserts! (<= block-height
                  (+ (get updated-at task) (var-get dispute-window-blocks)))
              ERR-DISPUTE-WINDOW-CLOSED)

    (map-set tasks task-id (merge task {
      status:     TASK-STATUS-DISPUTED,
      updated-at: block-height
    }))

    (increment-agent-disputed (get agent-id task))
    (try! (contract-call? .reputation update-task-stats (get agent-id task) TASK-STATUS-DISPUTED))
    (ok task-id)
  )
)

;; Resolve a dispute. Contract owner (admin) only.
;; refund-client: true => return funds to client; false => release to agent.
;; Returns: (ok task-id)
(define-public (resolve-dispute
    (task-id       uint)
    (refund-client bool)
    (usdcx-token   <sip010-ft-trait>)
  )
  (let
    (
      (task       (unwrap! (get-task-record task-id) ERR-TASK-NOT-FOUND))
      (agent-id   (get agent-id task))
      (agent      (unwrap! (contract-call? .agent-registry get-agent agent-id) ERR-AGENT-NOT-FOUND))
    )
    (asserts! (is-eq tx-sender CONTRACT-OWNER)                ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get status task) TASK-STATUS-DISPUTED)  ERR-INVALID-STATUS)

    (if refund-client
      ;; Refund path: return USDCx to client.
      (begin
        (try! (as-contract (contract-call? usdcx-token transfer
          (get amount-ustx task)
          tx-sender
          (get client task)
          none
        )))
        (increment-agent-refunded agent-id)
        (try! (contract-call? .reputation update-task-stats agent-id TASK-STATUS-REFUNDED))
        (map-set tasks task-id (merge task {
          status:     TASK-STATUS-REFUNDED,
          updated-at: block-height
        }))
      )
      ;; Release path: send USDCx to agent owner.
      (begin
        (try! (as-contract (contract-call? usdcx-token transfer
          (get amount-ustx task)
          tx-sender
          (get owner agent)
          none
        )))
        (increment-agent-completed agent-id)
        (try! (contract-call? .reputation update-task-stats agent-id TASK-STATUS-COMPLETED))
        (map-set tasks task-id (merge task {
          status:     TASK-STATUS-COMPLETED,
          updated-at: block-height
        }))
      )
    )
    (ok task-id)
  )
)

;; Cancel a pending task and refund the client. Client only.
;; Can only cancel while status is PENDING (before API server picks it up).
;; Returns: (ok task-id)
(define-public (cancel-task (task-id uint) (usdcx-token <sip010-ft-trait>))
  (let ((task (unwrap! (get-task-record task-id) ERR-TASK-NOT-FOUND)))
    (asserts! (is-eq tx-sender (get client task))            ERR-NOT-OWNER)
    (asserts! (is-eq (get status task) TASK-STATUS-PENDING)  ERR-INVALID-STATUS)

    ;; Refund USDCx to client.
    (try! (as-contract (contract-call? usdcx-token transfer
      (get amount-ustx task)
      tx-sender
      (get client task)
      none
    )))

    (map-set tasks task-id (merge task {
      status:     TASK-STATUS-CANCELLED,
      updated-at: block-height
    }))

    (try! (contract-call? .reputation update-task-stats (get agent-id task) TASK-STATUS-CANCELLED))
    (ok task-id)
  )
)

;; ---- READ-ONLY FUNCTIONS ----

(define-read-only (get-task (task-id uint))
  (map-get? tasks task-id)
)

(define-read-only (get-tasks-by-client (client principal))
  (default-to (list) (map-get? tasks-by-client client))
)

(define-read-only (get-tasks-by-agent (agent-id uint))
  (default-to (list) (map-get? tasks-by-agent agent-id))
)

(define-read-only (get-agent-task-counts (agent-id uint))
  (map-get? agent-task-counts agent-id)
)

(define-read-only (get-next-task-id)
  (var-get next-task-id)
)

(define-read-only (get-dispute-window)
  (var-get dispute-window-blocks)
)
