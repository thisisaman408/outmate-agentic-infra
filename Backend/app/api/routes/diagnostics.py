from fastapi import APIRouter
from fastapi.responses import JSONResponse
import logging
import asyncio

from app.core.redis import RedisManager
from app.db.session import SessionLocal
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/redis")
async def redis_health():
    try:
        client = RedisManager.get_client()
        # use async ping to verify readiness
        await client.ping()
        return {"status": "ok", "redis": True}
    except Exception as e:
        logger.error(f"Redis healthcheck failed: {e}")
        return JSONResponse(status_code=503, content={"status": "error", "redis": False, "error": str(e)})


@router.get("/supabase")
async def supabase_health():
    try:
        def _check():
            db = SessionLocal()
            try:
                db.execute(text("SELECT 1"))
                return True
            finally:
                db.close()

        loop = asyncio.get_event_loop()
        res = await asyncio.wait_for(loop.run_in_executor(None, _check), timeout=10.0)
        if res:
            return {"status": "ok", "supabase": True}
        raise Exception("Unknown DB error")
    except Exception as e:
        logger.error(f"Supabase healthcheck failed: {e}")
        return JSONResponse(status_code=503, content={"status": "error", "supabase": False, "error": str(e)})


@router.get("/all")
async def all_health():
    results = {"redis": None, "supabase": None}
    # Redis
    try:
        client = RedisManager.get_client()
        await client.ping()
        results["redis"] = True
    except Exception as e:
        results["redis"] = False
        results["redis_error"] = str(e)

    # Supabase
    try:
        def _check_db():
            db = SessionLocal()
            try:
                db.execute(text("SELECT 1"))
                return True
            finally:
                db.close()

        loop = asyncio.get_event_loop()
        ok = loop.run_in_executor(None, _check_db)
        res = await asyncio.wait_for(ok, timeout=10.0)
        results["supabase"] = bool(res)
    except Exception as e:
        results["supabase"] = False
        results["supabase_error"] = str(e)

    status_code = 200 if results.get("redis") and results.get("supabase") else 503
    return JSONResponse(status_code=status_code, content={"status": "ok" if status_code == 200 else "degraded", "results": results})
