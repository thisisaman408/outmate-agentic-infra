#!/usr/bin/env bash
# ============================================================================
# Local development runner — starts the three processes the app needs:
#
#   1. uvicorn      → FastAPI HTTP server            (port 8000)
#   2. celery worker → background tasks (voice campaigns, briefs, enrichment)
#   3. celery beat   → scheduled/periodic tasks      (daily syncs, briefs)
#
# Without the Celery worker, any endpoint that calls `.delay()` silently
# queues forever and the feature never runs — voice campaigns, daily briefs,
# signal re-scoring, etc.  In production we run each of these as a separate
# container (see ../docker-compose.yml, services: api / celery-worker /
# celery-beat).  Locally this script replaces that with one foreground
# command you Ctrl-C to stop all three.
#
# Usage:
#   cd Backend && ./start-dev.sh
#
# Flags:
#   --no-beat     skip celery beat (useful if you don't care about schedules)
#   --no-worker   skip celery worker (only if you're sure nothing async is in play)
#   --purge       purge the existing Celery queue before starting worker
#                 (kills the stale backlog accumulated while no worker ran)
# ============================================================================
set -euo pipefail

RUN_API=1
RUN_WORKER=1
RUN_BEAT=1
PURGE=0

for arg in "$@"; do
  case "$arg" in
    --no-beat)    RUN_BEAT=0 ;;
    --no-worker)  RUN_WORKER=0 ;;
    --no-api)     RUN_API=0 ;;
    --purge)      PURGE=1 ;;
    -h|--help)
      sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

# Export PYTHONPATH so the Backend/ directory is importable as `app.*`
cd "$(dirname "$0")"
export PYTHONUNBUFFERED=1

# Skip the SentenceTransformer preload on startup.  The preload hits an
# abseil/grpc mutex deadlock on some macOS configs, hanging uvicorn
# indefinitely before it ever binds :8000.  The embedding model still
# lazy-loads the first time something actually calls get_embedding_model(),
# so RAG queries still work — they just pay the ~3s load cost on first use.
# Only affects local dev; production sets this via container env.
# Override with OUTMATE_SKIP_EMBEDDING_PRELOAD=false ./start-dev.sh if you
# actually want the preload.
export OUTMATE_SKIP_EMBEDDING_PRELOAD="${OUTMATE_SKIP_EMBEDDING_PRELOAD:-true}"

PIDS=()
cleanup() {
  echo ""
  echo "shutting down: ${PIDS[*]:-none}"
  # Kill whole process groups so uvicorn's spawn child + celery's prefork
  # pool also go down.  -INT first, then -TERM if still alive.
  for pid in "${PIDS[@]:-}"; do
    kill -INT "$pid" 2>/dev/null || true
  done
  sleep 1
  for pid in "${PIDS[@]:-}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

if [[ "$PURGE" == "1" ]]; then
  echo "purging stale Celery queue..."
  python -m celery -A app.core.celery_app purge -f || true
fi

if [[ "$RUN_API" == "1" ]]; then
  echo "▶ starting uvicorn on :8000"
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
  PIDS+=($!)
fi

if [[ "$RUN_WORKER" == "1" ]]; then
  # Pool selection:
  #   * macOS → `threads`: prefork's fork() after ObjC runtime init crashes
  #     every child worker with SIGABRT ("NSCharacterSet initialize may have
  #     been in progress"). See https://github.com/celery/celery/issues/6552.
  #     Our tasks are IO-bound (Retell/BetterContact/Postgres), so threads
  #     give us real parallelism without the fork hazard.
  #   * Linux (CI, Docker, prod) → default prefork, which is what the
  #     Linux container image already uses.  No override needed.
  if [[ "$(uname -s)" == "Darwin" ]]; then
    POOL_ARGS="--pool=threads --concurrency=4"
    echo "▶ starting celery worker (pool=threads, concurrency=4) — macOS"
  else
    POOL_ARGS="--concurrency=2"
    echo "▶ starting celery worker (pool=prefork, concurrency=2)"
  fi
  # shellcheck disable=SC2086  # deliberate word-splitting of POOL_ARGS
  python -m celery -A app.core.celery_app worker --loglevel=info $POOL_ARGS &
  PIDS+=($!)
fi

if [[ "$RUN_BEAT" == "1" ]]; then
  echo "▶ starting celery beat"
  python -m celery -A app.core.celery_app beat --loglevel=info &
  PIDS+=($!)
fi

echo ""
echo "  api:    http://localhost:8000"
echo "  worker: celery@$(hostname) (concurrency=2)"
echo "  beat:   scheduler running"
echo ""
echo "Ctrl-C to stop all three."
# Wait on all children.  Exit status propagates from whichever dies first.
wait -n 2>/dev/null || wait
