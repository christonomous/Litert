import litert_lm
engine = litert_lm.Engine("gemma-4-E2B-it.litertlm")
def test_intent(text):
    prompt = f"<start_of_turn>user\nAnalyze this message: '{text}'\nIf the user is asking for information that requires a web search (like news, facts, current events, or a specific topic research), extract ONLY the essential search keywords to use in a search engine. Do NOT include conversational words or phrases like 'search the web' or 'research'. Output ONLY the clean keywords. If no search is needed, reply EXACTLY 'NO_SEARCH'.<end_of_turn>\n<start_of_turn>model\n"
    res = ""
    with engine.create_conversation() as conv:
        for chunk in conv.send_message_async(prompt):
            if 'content' in chunk and chunk['content']:
                res += chunk['content'][0].get('text', '')
    return res.strip()

print("1:", test_intent("who is the president of france right now?"))
print("2:", test_intent("write a python script to reverse a string"))
print("3:", test_intent("search the web about crypto"))
print("4:", test_intent("hi how are you"))
