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


def fetch_website(url):
    import requests
    import urllib3
    from bs4 import BeautifulSoup
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=10, verify=False)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        for tag in soup(['script', 'style', 'header', 'footer', 'nav', 'noscript']):
            tag.decompose()
            
        for a in soup.find_all('a', href=True):
            if a.text.strip() and not a['href'].startswith('javascript:'):
                href = a['href']
                if href.startswith('/'):
                    from urllib.parse import urljoin
                    href = urljoin(url, href)
                a.replace_with(f"[{a.text.strip()}]({href})")
                
        text = soup.get_text(separator=' ')
        import re
        text = re.sub(r'\s+', ' ', text)
        return text.strip()[:3500]
    except Exception as e:
        return f"Error fetching website: {e}"

def prune_context(context, max_chars=9000):
    if len(context) < max_chars:
        return context
    
    # Very simple pruning: keep headers and the most recent visits
    # Split by the section markers we use
    sections = context.split("\n\n")
    if len(sections) < 2:
        return context[-max_chars:] # Fallback
    
    # Priority: Keep the 2 most recent sections entirely
    # and truncate the earlier ones to just their headers/first bits
    pruned = []
    # Keep headers for context, but drop the heavy content of old visits
    for i, section in enumerate(sections[:-2]):
        lines = section.split('\n')
        if lines:
            pruned.append(lines[0] + " ... (truncated for space)")
    
    # Add the most recent 2 sections in full
    pruned.extend(sections[-2:])
    
    new_context = "\n\n".join(pruned)
    if len(new_context) > max_chars:
        return new_context[-max_chars:]
    return new_context

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

    async def generate():
        try:
            agent_context = ""
            action_count = 0
            
            while action_count < 5:
                last_user_msg = next((m for m in reversed(request.messages) if m.role == "user"), None)
                if not last_user_msg:
                    break
                    
                agent_prompt = f"<start_of_turn>user\nYou are the Action Coordinator. Your goal: '{last_user_msg.content}'\n\n[INSTRUCTIONS]\n1. Review the Collected Data for Markdown links: `[Title](URL)`.\n2. If you see a link that likely contains the answer (e.g., a specific news story link within a main page), you MUST use `VISIT: <url>` on it immediately.\n3. DO NOT search if the link you need is already in the data.\n4. ONLY if you have the full, detailed content required to answer the user request, reply 'DONE'.\n\nOutput ONLY: 'SEARCH: <query>', 'VISIT: <url>', or 'DONE'.\n\n[COLLECTED DATA]\n{agent_context}<end_of_turn>\n<start_of_turn>model\n"
                
                action = ""
                with engine.create_conversation() as conv:
                    for chunk in conv.send_message_async(agent_prompt):
                        if 'content' in chunk and chunk['content']:
                            action += chunk['content'][0].get('text', '')
                
                action = action.strip()
                if "DONE" in action.upper():
                    break
                if "SEARCH:" not in action and "VISIT:" not in action:
                    # If it's something else, it might be the AI starting to answer too early
                    break
                    
                if "SEARCH:" in action:
                    query = action.split("SEARCH:")[1].split('\n')[0].strip()
                    logger.info(f"Agent Action Loop: SEARCH -> {query}")
                    import json
                    msg_data = json.dumps({'status': f'SEARCH [{query}]'})
                    yield f"data: {msg_data}\n\n"
                    
                    try:
                        from ddgs import DDGS
                        with DDGS() as ddgs:
                            results = list(ddgs.text(query, max_results=3))
                            search_res = f"Search Results for '{query}':\n"
                            if results:
                                for res in results:
                                    search_res += f"- [{res.get('title')}]({res.get('href')}): {res.get('body')}\n"
                            else:
                                search_res += "No results found.\n"
                            agent_context = prune_context(agent_context + search_res + "\n")
                    except Exception as e:
                        agent_context += f"Search error: {e}\n"
                
                elif "VISIT:" in action:
                    url = action.split("VISIT:")[1].split('\n')[0].strip()
                    logger.info(f"Agent Action Loop: VISIT -> {url}")
                    import json
                    msg_data = json.dumps({'status': f'VISIT [{url}]'})
                    yield f"data: {msg_data}\n\n"
                    
                    website_content = fetch_website(url)
                    agent_context = prune_context(agent_context + f"Website Content for '{url}':\n{website_content}\n\n")
                
                action_count += 1

            system_prompt_content = "[SYSTEM: ReAct Agent Enabled]\n"
            import os
            try:
                if os.path.exists("system_prompt.md"):
                    with open("system_prompt.md", "r") as f:
                        system_prompt_content = f.read().strip() + "\n"
            except Exception as e:
                pass
                
            if agent_context:
                system_prompt_content += "\n[COLLECTED RESEARCH DATA]\n" + agent_context

            # Signal transition to final answer generation
            yield f"data: {json.dumps({'status': 'SUMMARIZING'})}\n\n"

            formatted_prompt = ""
            for i, msg in enumerate(request.messages):
                role = "user" if msg.role == "user" else "model"
                content = msg.content
                if msg.role == "user" and i == len(request.messages) - 1:
                    content = f"{system_prompt_content}\n\nUSER REQUEST: {content}"
                formatted_prompt += f"<start_of_turn>{role}\n{content}<end_of_turn>\n"
            
            if not formatted_prompt.endswith("<start_of_turn>model\n"):
                formatted_prompt += "<start_of_turn>model\n"

            with engine.create_conversation() as conv:
                logger.info("Starting inference with conversation history")
                import json
                for chunk in conv.send_message_async(formatted_prompt):
                    if 'content' in chunk and len(chunk['content']) > 0:
                        text = chunk['content'][0].get('text', '')
                        if text:
                            yield f"data: {json.dumps({'text': text})}\n\n"
                logger.info("Inference complete.")
        except Exception as e:
            logger.error(f"Inference error: {e}")
            import json
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
