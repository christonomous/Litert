import os
import requests
import threading
import logging
import asyncio
import json
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import litert_lm

# Configure logging
class QueueHandler(logging.Handler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.queue = asyncio.Queue()
        self.loop = asyncio.get_event_loop()

    def emit(self, record):
        try:
            msg = self.format(record)
            if self.loop.is_running():
                self.loop.call_soon_threadsafe(self.queue.put_nowait, msg)
        except Exception:
            pass

log_handler = QueueHandler()
log_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))

logging.basicConfig(level=logging.INFO, handlers=[logging.StreamHandler(), log_handler])
logger = logging.getLogger(__name__)

app = FastAPI(title="Gemma LiteRT Backend")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state to track progress
download_status = {
    "progress": 0, 
    "status": "idle", 
    "error": None,
    "total_size": 0,
    "downloaded": 0
}
MODEL_PATH = "gemma-4-E2B-it.litertlm"
engine = None

def init_download_status():
    global download_status
    if os.path.exists(MODEL_PATH) and os.path.getsize(MODEL_PATH) > 0:
        download_status["status"] = "complete"
        download_status["progress"] = 100
        logger.info(f"Model found at {MODEL_PATH}, skipping download.")
    else:
        logger.info(f"Model not found at {MODEL_PATH}.")

init_download_status()

def download_worker():
    global download_status
    url = "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm"
    try:
        logger.info(f"Starting download from {url}")
        download_status["status"] = "downloading"
        download_status["error"] = None
        
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        download_status["total_size"] = total_size
        
        downloaded = 0
        with open(MODEL_PATH, "wb") as f:
            for chunk in response.iter_content(chunk_size=1024 * 1024): # 1MB chunks
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    download_status["downloaded"] = downloaded
                    if total_size > 0:
                        download_status["progress"] = int((downloaded / total_size) * 100)
                    else:
                        download_status["progress"] = -1 # Size unknown
        
        logger.info("Download complete")
        download_status["status"] = "complete"
        download_status["progress"] = 100
    except Exception as e:
        logger.error(f"Download failed: {e}")
        download_status["status"] = "error"
        download_status["error"] = str(e)

@app.post("/start-download")
async def start_download():
    if download_status["status"] == "complete":
        return {"message": "Model already downloaded"}
    
    if download_status["status"] == "downloading":
        return {"message": "Download already in progress"}
    
    thread = threading.Thread(target=download_worker, daemon=True)
    thread.start()
    return {"message": "Download started"}

@app.get("/status")
async def get_status():
    return download_status

@app.get("/system-logs")
async def system_logs():
    async def log_generator():
        while True:
            try:
                msg = await log_handler.queue.get()
                yield f"data: {msg}\n\n"
            except Exception as e:
                logger.error(f"Log generator error: {e}")
                break
    return StreamingResponse(log_generator(), media_type="text/event-stream")

from pydantic import BaseModel
from typing import List

class Message(BaseModel):
    role: str
    content: str
    
class ChatRequest(BaseModel):
    messages: List[Message]

@app.post("/chat")
async def chat(request: ChatRequest):
    global engine
    
    # Load engine only when first needed after download
    if engine is None:
        if not os.path.exists(MODEL_PATH):
            raise HTTPException(status_code=400, detail="Model file not found. Please download it first.")
        
        try:
            logger.info(f"Initializing LiteRT engine with {MODEL_PATH}")
            engine = litert_lm.Engine(MODEL_PATH)
        except Exception as e:
            logger.error(f"Failed to load engine: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")
    
    search_context = ""
    if request.messages:
        last_user_msg = next((m for m in reversed(request.messages) if m.role == "user"), None)
        if last_user_msg:
            # 1. Intent Check
            intent_prompt = f"<start_of_turn>user\nAnalyze this message: '{last_user_msg.content}'\nIf the user is asking for information that requires a web search (like news, facts, current events, or a specific topic research), extract ONLY the essential search keywords to use in a search engine. Do NOT include conversational words or phrases like 'search the web' or 'research'. Output ONLY the clean keywords. If no search is needed, reply EXACTLY 'NO_SEARCH'.<end_of_turn>\n<start_of_turn>model\n"
            search_query = ""
            try:
                with engine.create_conversation() as conv:
                    for chunk in conv.send_message_async(intent_prompt):
                        if 'content' in chunk and chunk['content']:
                            search_query += chunk['content'][0].get('text', '')
            except Exception as e:
                logger.error(f"Intent check failed: {e}")
            
            search_query = search_query.strip()
            
            # 2. Execute Search if intended
            if search_query and "NO_SEARCH" not in search_query.upper():
                try:
                    logger.info(f"AI decided to search the web for: {search_query}")
                    from ddgs import DDGS
                    with DDGS() as ddgs:
                        results = list(ddgs.text(search_query, max_results=5))
                        if results:
                            # Load dynamic system prompt for search behavior
                            system_prompt_content = "[SYSTEM: Real-time Web Search Results Provided]\n"
                            try:
                                if os.path.exists("system_prompt.md"):
                                    with open("system_prompt.md", "r") as f:
                                        system_prompt_content = f.read().strip() + "\n\n[SEARCH RESULTS]\n"
                            except Exception as e:
                                logger.error(f"Could not read system_prompt.md: {e}")
                            
                            search_context = system_prompt_content
                            for idx, res in enumerate(results):
                                search_context += f"Source {idx+1}: [{res.get('title')}]({res.get('href')}) - {res.get('body')}\n"
                            logger.info("Search context attached successfully.")
                        else:
                            logger.info("DuckDuckGo returned 0 results.")
                except Exception as e:
                    logger.error(f"Web search failed: {e}")

    async def generate():
        try:
            formatted_prompt = ""
            for i, msg in enumerate(request.messages):
                role = "user" if msg.role == "user" else "model"
                content = msg.content
                if msg.role == "user" and i == len(request.messages) - 1 and search_context:
                    content = f"{search_context}\n\nUSER REQUEST: {content}"
                formatted_prompt += f"<start_of_turn>{role}\n{content}<end_of_turn>\n"
            
            if not formatted_prompt.endswith("<start_of_turn>model\n"):
                formatted_prompt += "<start_of_turn>model\n"

            with engine.create_conversation() as conv:
                logger.info("Starting inference with conversation history")
                for chunk in conv.send_message_async(formatted_prompt):
                    if 'content' in chunk and len(chunk['content']) > 0:
                        text = chunk['content'][0].get('text', '')
                        if text:
                            yield f"data: {json.dumps({'text': text})}\n\n"
                logger.info("Inference complete.")
        except Exception as e:
            logger.error(f"Inference error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
