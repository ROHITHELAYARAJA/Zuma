import asyncio
import base64
import hmac
import os
from fastapi import FastAPI, Header, HTTPException, Depends
from pydantic import BaseModel, Field
from .rag import answer_question

app = FastAPI(title="Zuma private AWS evidence service", docs_url=None, redoc_url=None)

def authorized(authorization: str = Header(default="")):
    key = os.environ.get("RAG_SERVICE_API_KEY", "")
    if len(key) < 32 or not hmac.compare_digest(authorization, "Bearer " + key):
        raise HTTPException(401, "SERVICE_AUTHENTICATION_REQUIRED")

class Scope(BaseModel):
    reportId: str = Field(max_length=30)
    patientId: str = Field(max_length=100)
    sourceVersion: str = Field(min_length=1, max_length=128)

class Question(Scope):
    question: str = Field(min_length=1, max_length=4000)

class Speech(Scope):
    audioBase64: str = Field(min_length=1, max_length=1280000)
    sampleRate: int = 16000

@app.get("/health")
def health():
    return {"ok": True, "service": "zuma-aws", "awsConfigured": bool(os.environ.get("BEDROCK_KNOWLEDGE_BASE_ID")), "cloudConnectionTested": False}

@app.post("/answer", dependencies=[Depends(authorized)])
async def answer(body: Question):
    try:
        return await asyncio.wait_for(asyncio.to_thread(answer_question, body.question, body.reportId, body.patientId, body.sourceVersion), timeout=90)
    except Exception as exc:
        code = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
        raise HTTPException(503, code) from None

@app.post("/voice", dependencies=[Depends(authorized)])
async def voice(body: Speech):
    if body.sampleRate != 16000:
        raise HTTPException(422, "PCM_16KHZ_MONO_16BIT_REQUIRED")
    try:
        pcm = base64.b64decode(body.audioBase64, validate=True)
        if not pcm or len(pcm) > 960000 or len(pcm) % 2:
            raise ValueError("AUDIO_MUST_BE_16BIT_PCM_UP_TO_30_SECONDS")
        from .voice import speech_answer
        async def grounded(question):
            return await asyncio.to_thread(answer_question, question, body.reportId, body.patientId, body.sourceVersion)
        return await asyncio.wait_for(speech_answer(pcm, grounded), timeout=110)
    except Exception as exc:
        code = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
        raise HTTPException(503, code) from None
