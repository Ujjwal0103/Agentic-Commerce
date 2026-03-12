;; reputation.clar
;; Tracks per-agent reputation: task completion stats and client ratings.
;; Only the task-escrow contract can call update-task-stats.
;; Clients rate completed tasks 1–5 stars (stored as 100–500 for precision).

;; ---- TASK STATUS CONSTANTS (mirror from task-escrow, cannot import) ----

(define-constant TASK-STATUS-PENDING    u0)
(define-constant TASK-STATUS-PROCESSING u1)
(define-constant TASK-STATUS-COMPLETED  u2)
(define-constant TASK-STATUS-DISPUTED   u3)
(define-constant TASK-STATUS-REFUNDED   u4)
(define-constant TASK-STATUS-CANCELLED  u5)

;; ---- ERROR CODES ----

(define-constant ERR-NOT-AUTHORIZED       (err u300))
(define-constant ERR-AGENT-NOT-FOUND      (err u301))
(define-constant ERR-INVALID-RATING       (err u302))
(define-constant ERR-ALREADY-RATED        (err u303))
(define-constant ERR-TASK-NOT-COMPLETED   (err u304))
(define-constant ERR-NOT-TASK-CLIENT      (err u305))
(define-constant ERR-TASK-NOT-FOUND       (err u306))

;; ---- DATA ----

;; The escrow contract is the only authorized caller of update-task-stats.
(define-data-var escrow-contract principal .task-escrow)

;; Per-agent aggregate reputation.
(define-map agent-reputation
  uint
  {
    total-tasks:     uint,
    completed-tasks: uint,
    disputed-tasks:  uint,
    refunded-tasks:  uint,
    total-rating:    uint,  ;; sum of ratings (100–500 scale per rating)
    rating-count:    uint,
    last-updated:    uint
  }
)

;; Tracks whether a task has been rated (prevents double-rating).
(define-map task-ratings
  uint
  {
    rating:   uint,
    rater:    principal,
    rated-at: uint
  }
)

;; ---- PRIVATE HELPERS ----

(define-private (get-rep (agent-id uint))
  (default-to
    { total-tasks: u0, completed-tasks: u0, disputed-tasks: u0, refunded-tasks: u0,
      total-rating: u0, rating-count: u0, last-updated: u0 }
    (map-get? agent-reputation agent-id)
  )
)

;; ---- PUBLIC FUNCTIONS ----

;; Called by task-escrow on every task status change.
;; Only the escrow contract can call this (contract-caller check).
;; Returns: (ok true)
(define-public (update-task-stats (agent-id uint) (new-status uint))
  (let ((rep (get-rep agent-id)))
    (asserts! (is-eq contract-caller (var-get escrow-contract)) ERR-NOT-AUTHORIZED)

    (map-set agent-reputation agent-id
      (merge rep
        (if (is-eq new-status TASK-STATUS-PENDING)
          { total-tasks: (+ (get total-tasks rep) u1), last-updated: block-height }
          (if (is-eq new-status TASK-STATUS-COMPLETED)
            { completed-tasks: (+ (get completed-tasks rep) u1), last-updated: block-height }
            (if (is-eq new-status TASK-STATUS-DISPUTED)
              { disputed-tasks: (+ (get disputed-tasks rep) u1), last-updated: block-height }
              (if (is-eq new-status TASK-STATUS-REFUNDED)
                { refunded-tasks: (+ (get refunded-tasks rep) u1), last-updated: block-height }
                ;; PROCESSING, CANCELLED — no count change
                { last-updated: block-height }
              )
            )
          )
        )
      )
    )
    (ok true)
  )
)

;; Client rates a completed task. 1–5 stars stored as 100–500 (uint * 100).
;; Verifies: task exists, caller is original client, task completed, not already rated.
;; Returns: (ok true)
(define-public (rate-task (task-id uint) (rating uint))
  (let
    (
      (task (unwrap! (contract-call? .task-escrow get-task task-id) ERR-TASK-NOT-FOUND))
    )
    (asserts! (is-eq tx-sender (get client task))              ERR-NOT-TASK-CLIENT)
    (asserts! (is-eq (get status task) TASK-STATUS-COMPLETED)  ERR-TASK-NOT-COMPLETED)
    (asserts! (and (>= rating u100) (<= rating u500))          ERR-INVALID-RATING)
    (asserts! (is-none (map-get? task-ratings task-id))        ERR-ALREADY-RATED)

    (let
      (
        (agent-id (get agent-id task))
        (rep      (get-rep agent-id))
      )
      (map-set task-ratings task-id {
        rating:   rating,
        rater:    tx-sender,
        rated-at: block-height
      })

      (map-set agent-reputation agent-id (merge rep {
        total-rating: (+ (get total-rating rep) rating),
        rating-count: (+ (get rating-count rep) u1),
        last-updated: block-height
      }))

      (ok true)
    )
  )
)

;; ---- READ-ONLY FUNCTIONS ----

(define-read-only (get-agent-reputation (agent-id uint))
  (map-get? agent-reputation agent-id)
)

;; Returns average rating * 100 (e.g. u425 = 4.25 stars). Returns u0 if no ratings.
(define-read-only (get-average-rating (agent-id uint))
  (let ((rep (get-rep agent-id)))
    (if (is-eq (get rating-count rep) u0)
      u0
      (/ (get total-rating rep) (get rating-count rep))
    )
  )
)

;; Returns completion rate as integer percentage 0–100.
(define-read-only (get-completion-rate (agent-id uint))
  (let ((rep (get-rep agent-id)))
    (if (is-eq (get total-tasks rep) u0)
      u0
      (/ (* (get completed-tasks rep) u100) (get total-tasks rep))
    )
  )
)

(define-read-only (get-task-rating (task-id uint))
  (map-get? task-ratings task-id)
)
