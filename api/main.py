from __future__ import annotations

import asyncio
import json
import os
import re
from contextlib import asynccontextmanager
from typing import Any

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.responses import Response

LM_STUDIO_BASE = os.getenv("LM_STUDIO_BASE", "http://127.0.0.1:1234").rstrip("/")
FALLBACK_MODEL = "qwen3-4b"
PRESET_NAME = "Parallax"
CONTEXT_LENGTH = 1792
GPU_OFFLOAD = 21
CPU_THREADS = 5
REPEAT_PENALTY = 1.1
MAX_INPUT_CHARS = 1200
MAX_TOKENS = 32

SYSTEM_PROMPT = (
    "Jesteś klasyfikatorem treści w social mediach. "
    "Na podstawie opisu posta masz określić czy jest to negatywny content czy nie. "
    "Tworzymy wtyczkę do przeglądarki, która ukrywa negatywny content dla użytkownika."
)

CLASSIFICATION_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "post_classification",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "is_negative": {
                    "type": "boolean",
                    "description": (
                        "Czy post zawiera negatywny content, "
                        "który powinien zostać ukryty przed użytkownikiem."
                    ),
                }
            },
            "required": ["is_negative"],
            "additionalProperties": False,
        },
    },
}

classify_lock = asyncio.Lock()
http_client: httpx.AsyncClient | None = None
cached_model_id: str | None = None
model_load_attempted = False


class ClassifyRequest(BaseModel):
    text: str = Field(default="", max_length=8000)


class ClassifyResponse(BaseModel):
    ok: bool
    isNegative: bool
    is_negative: bool
    error: str | None = None


class HealthResponse(BaseModel):
    ok: bool
    model: str | None = None
    lmStudio: str | None = None
    error: str | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=5.0))
    try:
        await ensure_model_load()
    except Exception:
        pass
    yield
    await http_client.aclose()
    http_client = None


app = FastAPI(title="Parallax API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def allow_private_network(request: Request, call_next):
    if request.method == "OPTIONS" and request.headers.get("access-control-request-private-network"):
        origin = request.headers.get("origin", "*")
        response = Response(status_code=204)
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response

    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


def client() -> httpx.AsyncClient:
    if http_client is None:
        raise RuntimeError("HTTP client is not ready")
    return http_client


async def lm_get(path: str) -> httpx.Response:
    return await client().get(
        f"{LM_STUDIO_BASE}{path}",
        headers={"Authorization": "Bearer lm-studio", "Accept": "application/json"},
    )


async def lm_post(path: str, payload: dict[str, Any]) -> httpx.Response:
    return await client().post(
        f"{LM_STUDIO_BASE}{path}",
        headers={
            "Authorization": "Bearer lm-studio",
            "Content-Type": "application/json",
        },
        json=payload,
    )


async def get_model_id() -> str:
    global cached_model_id
    if cached_model_id:
        return cached_model_id

    response = await lm_get("/v1/models")
    response.raise_for_status()
    models = response.json().get("data") or []
    cached_model_id = next(
        (item.get("id") for item in models if item.get("id") and "embed" not in item["id"].lower()),
        models[0]["id"] if models else FALLBACK_MODEL,
    )
    return cached_model_id


async def ensure_model_load() -> None:
    global model_load_attempted
    if model_load_attempted:
        return
    model_load_attempted = True

    model = await get_model_id()
    attempts = [
        {
            "model": model,
            "context_length": CONTEXT_LENGTH,
            "flash_attention": True,
            "offload_kv_cache_to_gpu": True,
            "gpu_offload": GPU_OFFLOAD,
            "n_gpu_layers": GPU_OFFLOAD,
            "n_threads": CPU_THREADS,
        },
        {
            "model": model,
            "context_length": CONTEXT_LENGTH,
            "flash_attention": True,
            "offload_kv_cache_to_gpu": True,
        },
    ]
    for body in attempts:
        try:
            response = await lm_post("/api/v1/models/load", body)
            if response.is_success:
                return
        except httpx.HTTPError:
            continue


def as_text(value: Any) -> str:
    if not value:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(as_text(part.get("text") if isinstance(part, dict) else part) for part in value)
    return str(value)


def extract_message_text(message: dict[str, Any]) -> str:
    parsed = message.get("parsed")
    if isinstance(parsed, dict):
        return json.dumps(parsed)
    return "\n".join(
        filter(
            None,
            [
                as_text(message.get("content")),
                as_text(message.get("reasoning_content")),
                as_text(message.get("reasoning")),
            ],
        )
    )


def coerce_negative(value: Any) -> bool:
    if value is True or value == 1:
        return True
    if value is False or value in (0, None):
        return False
    return str(value).strip().lower() in {"true", "yes", "tak", "1"}


def parse_is_negative(raw: str) -> bool:
    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", raw or "", flags=re.I)
    cleaned = re.sub(r"```(?:json)?", "", cleaned, flags=re.I).strip()
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        return False
    try:
        parsed = json.loads(match.group(0))
        return coerce_negative(
            parsed.get("is_negative", parsed.get("isNegative", parsed.get("negative")))
        )
    except json.JSONDecodeError:
        return bool(re.search(r'"is_negative"\s*:\s*true', cleaned, flags=re.I))


async def classify_text(text: str) -> bool:
    content = text.strip()[:MAX_INPUT_CHARS]
    if not content:
        return False

    model = await get_model_id()
    body: dict[str, Any] = {
        "model": model,
        "preset": PRESET_NAME,
        "temperature": 0,
        "max_tokens": MAX_TOKENS,
        "stream": False,
        "repeat_penalty": REPEAT_PENALTY,
        "enable_thinking": False,
        "reasoning": "off",
        "chat_template_kwargs": {"enable_thinking": False},
        "response_format": CLASSIFICATION_SCHEMA,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"/no_think\n{content}"},
        ],
    }

    response = await lm_post("/v1/chat/completions", body)
    if response.status_code == 400 and "preset" in response.text.lower():
        body.pop("preset", None)
        response = await lm_post("/v1/chat/completions", body)
    response.raise_for_status()

    payload = response.json()
    message = ((payload.get("choices") or [{}])[0].get("message")) or {}
    raw = extract_message_text(message)
    return parse_is_negative(raw)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    try:
        model = await get_model_id()
        return HealthResponse(ok=True, model=model, lmStudio=LM_STUDIO_BASE)
    except Exception as error:
        return HealthResponse(ok=False, lmStudio=LM_STUDIO_BASE, error=str(error))


@app.post("/classify", response_model=ClassifyResponse)
async def classify(request: ClassifyRequest) -> ClassifyResponse:
    try:
        async with classify_lock:
            is_negative = await classify_text(request.text)
        return ClassifyResponse(ok=True, isNegative=is_negative, is_negative=is_negative)
    except Exception as error:
        return ClassifyResponse(
            ok=False,
            isNegative=False,
            is_negative=False,
            error=str(error),
        )
