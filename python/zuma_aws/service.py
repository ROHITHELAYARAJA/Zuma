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

class ChatTurn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)

class Question(Scope):
    question: str = Field(min_length=1, max_length=4000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=6)

class Speech(Scope):
    audioBase64: str = Field(min_length=1, max_length=1280000)
    sampleRate: int = 16000

class ComparisonRecord(BaseModel):
    id: str = Field(min_length=1, max_length=150)
    recordId: str = Field(pattern=r"^record-[A-Za-z0-9_-]{1,120}$")
    hospitalId: str = Field(pattern="^[AB]$")
    version: int = Field(ge=1)
    category: str = Field(pattern="^(lab|allergy|medication|note)$")
    text: str = Field(min_length=1, max_length=18000)
    sha256: str = Field(pattern="^[a-f0-9]{64}$")

class ComparisonQuestion(BaseModel):
    patientId: str = Field(pattern="^ravi$")
    sourceVersion: str = Field(min_length=1, max_length=128)
    question: str = Field(min_length=1, max_length=4000)
    records: list[ComparisonRecord] = Field(min_length=1, max_length=80)

class EvidenceObject(BaseModel):
    key: str = Field(max_length=300)
    metadataKey: str = Field(max_length=320)
    html: str = Field(max_length=30000)
    metadata: str = Field(max_length=10000)

class ComparisonIngestion(BaseModel):
    objects: list[EvidenceObject] = Field(min_length=1, max_length=80)

class ComparisonSpeech(ComparisonQuestion):
    audioBase64: str = Field(min_length=1, max_length=1280000)
    sampleRate: int = 16000

@app.post("/comparison/voice", dependencies=[Depends(authorized)])
async def comparison_voice(body: ComparisonSpeech):
    from .comparison import answer_comparison
    from .voice import speech_answer
    try:
        pcm = base64.b64decode(body.audioBase64, validate=True)
        if body.sampleRate != 16000 or not pcm or len(pcm) > 960000 or len(pcm) % 2:
            raise ValueError("PCM_16KHZ_MONO_UP_TO_30_SECONDS_REQUIRED")
        async def grounded(question):
            return await asyncio.to_thread(answer_comparison, {**body.model_dump(), "question": question})
        return await asyncio.wait_for(speech_answer(pcm, grounded), timeout=110)
    except Exception as exc:
        raise HTTPException(503, str(exc) if isinstance(exc, ValueError) else type(exc).__name__) from None

@app.post("/comparison/answer", dependencies=[Depends(authorized)])
async def comparison_answer(body: ComparisonQuestion):
    from .comparison import answer_comparison
    try:
        return await asyncio.wait_for(asyncio.to_thread(answer_comparison, body.model_dump()), timeout=100)
    except Exception as exc:
        raise HTTPException(503, str(exc) if isinstance(exc, ValueError) else type(exc).__name__) from None

@app.post("/comparison/ingest", dependencies=[Depends(authorized)])
async def comparison_ingest(body: ComparisonIngestion):
    from .comparison import ingest_comparison
    try:
        return await asyncio.wait_for(asyncio.to_thread(ingest_comparison, [item.model_dump() for item in body.objects]), timeout=100)
    except Exception as exc:
        raise HTTPException(503, str(exc) if isinstance(exc, ValueError) else type(exc).__name__) from None

@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {"service": "zuma-aws-evidence", "health": "/health", "authorization": "Clinical API service key required for patient queries"}

@app.get("/health")
def health():
    from .comparison import COMPARISON_ENVIRONMENT
    return {"ok": True, "service": "zuma-aws", "awsConfigured": bool(os.environ.get("BEDROCK_KNOWLEDGE_BASE_ID")), "comparisonMissingConfiguration": [name for name in COMPARISON_ENVIRONMENT if not os.environ.get(name, "").strip()], "cloudConnectionTested": False, "answerFormat": "concise-cited-clinical-brief-v4", "textModel": os.environ.get("BEDROCK_TEXT_MODEL_ID"), "retrievalProvider": "bedrock-managed", "answerContext": "AWS retrieval results only", "citationValidation": "scoped-source-allowlist-v2"}

@app.post("/answer", dependencies=[Depends(authorized)])
async def answer(body: Question):
    try:
        return await asyncio.wait_for(asyncio.to_thread(answer_question, body.question, body.reportId, body.patientId, body.sourceVersion, [turn.model_dump() for turn in body.history]), timeout=90)
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
