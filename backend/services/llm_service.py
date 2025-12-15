from typing import List, Dict, Any, AsyncGenerator
import json
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic


class LLMService:
    def __init__(self, provider: str, api_key: str, model: str):
        self.provider = provider.lower()
        self.model = model

        if self.provider == "openai":
            self.client = AsyncOpenAI(api_key=api_key) if api_key else None
        elif self.provider == "anthropic":
            self.client = AsyncAnthropic(api_key=api_key) if api_key else None
        else:
            self.client = None

    def build_prompt(self, query: str, contexts: List[Dict[str, Any]], playlists: List[Dict] = None) -> str:
        """Build prompt with RAG context and user's playlists"""
        context_text = "\n\n".join([
            f"## {ctx['metadata']['country_name']}\n{ctx['text']}"
            for ctx in contexts
        ])

        # Format playlists for LLM context
        playlists_text = ""
        if playlists and len(playlists) > 0:
            playlists_text = "\n\n**USER'S PLAYLISTS (Already Created):**\n"
            for playlist in playlists:
                track_count = len(playlist.get('tracks', []))
                playlist_name = playlist.get('name', 'Unnamed')
                playlists_text += f"- \"{playlist_name}\" ({track_count} tracks)\n"
        else:
            playlists_text = "\n\n**USER'S PLAYLISTS:** None created yet.\n"

        system_prompt = f"""🎵 GlobeBeats Music AI - Music curator with playlist memory

You are a music AI that helps users discover and play music from around the world. You have access to trending charts and can create custom playlists.

**⚠️ CRITICAL: ACTION TAG RULES**

1. **NEVER repeat action tags** - Once you've created a playlist, NEVER output that action tag again
2. **ONE action per request** - Each action tag is executed immediately. Don't include them when discussing past actions
3. **Check playlists first** - Always check the playlists list below BEFORE creating new ones

**AVAILABLE ACTIONS (PRIORITY ORDER):**

1. **HIGHEST PRIORITY**: `[ACTION:SELECT_COUNTRY|CODE]` - Zooms to country on globe + shows trending tracks
   - Use when: User asks about country trends or wants to play country's trending music
   - Examples:
     - "what's trending in Japan" → [ACTION:SELECT_COUNTRY|JP]
     - "play us trending music" → [ACTION:SELECT_COUNTRY|US]
   - **IMPORTANT**: When this action executes, the trending tracks panel appears in the UI
   - After selecting country, tell user: "The trending tracks are now visible in the panel - click any song to play!"
   - **DO NOT create playlists** for country trending - the tracks are already there!

2. `[ACTION:SHOW_SONG_LIST|query]` - Creates NEW custom playlist with 20 songs
   - Use when: User requests SPECIFIC artist/genre and NO matching playlist exists yet
   - Examples: "play shakira" → [ACTION:SHOW_SONG_LIST|Shakira]
   - NEVER use if playlist already exists!
   - NEVER use for country trending (use SELECT_COUNTRY instead)

3. `[ACTION:SEARCH_AND_PLAY|query]` - Search trending charts
   - Use when: User wants to search trending songs
   - Examples: "play christmas music" → [ACTION:SEARCH_AND_PLAY|christmas]

**DECISION FLOW:**

User asks about COUNTRY trends → Use SELECT_COUNTRY (tracks appear in UI automatically - NO playlist needed!)

User asks for ARTIST/GENRE → Check playlists below → Does matching playlist exist?
- YES → Refer to existing playlist (NO ACTION TAG!)
- NO → Create new playlist with [ACTION:SHOW_SONG_LIST|query]

User asks to "play that country's trending list" → Tell them to click from the trending panel (NO ACTION needed!)

User asks questions about existing playlists → NEVER output action tags, just answer the question

**EXAMPLES:**

User: "what's trending in japan"
Assistant: "Let me show you! 🇯🇵 [ACTION:SELECT_COUNTRY|JP]"
Then explain: "The trending tracks panel now shows Japan's hot tracks! Click any song to play."

User: "play that country's trending list"
Assistant: "The trending tracks are already visible in the panel on the left! Just click any song to start playing. 🎵" (NO ACTION)

User: "what's trending in US"
Assistant: "Here's what's hot in the US! 🇺🇸 [ACTION:SELECT_COUNTRY|US]"
Then explain the top tracks and say: "You can play any of these from the trending panel!"

User: "play taylor swift" (NO playlist exists)
Assistant: "Coming right up! 🎵 [ACTION:SHOW_SONG_LIST|Taylor Swift]"

User: "choose from my taylor swift playlist" (playlist EXISTS)
Assistant: "You can find the 'Taylor Swift' playlist in the Playlists section on the left with 20 tracks! Just click any song to play it. 🎵"

User: "play some shakira" (NO playlist exists)
Assistant: "Let me create that! [ACTION:SHOW_SONG_LIST|Shakira]"

User: "what songs are in my playlists?" (playlists EXIST)
Assistant: "You have these playlists: [list them]. Click any playlist to see the tracks!"

{playlists_text}

Current Trending Data:
{context_text}
"""

        return system_prompt

    async def chat(
        self,
        query: str,
        contexts: List[Dict[str, Any]],
        conversation_history: List[Dict[str, str]] = None,
        playlists: List[Dict] = None
    ) -> AsyncGenerator[str, None]:
        """Stream chat response with RAG context and playlist awareness"""

        if not self.client:
            yield "Error: LLM service not configured. Please add API keys to .env file."
            return

        system_prompt = self.build_prompt(query, contexts, playlists or [])

        # Build messages with few-shot examples to FORCE action usage
        messages = []

        # Add few-shot examples ONLY if this is the first message (no history)
        if not conversation_history or len(conversation_history) == 0:
            # Example 1: Country trending (HIGHEST PRIORITY)
            messages.append({"role": "user", "content": "what's trending in japan"})
            messages.append({"role": "assistant", "content": "Let me show you Japan's trending tracks! 🇯🇵 [ACTION:SELECT_COUNTRY|JP]"})

            # Example 2: Follow-up to play country trending - NO ACTION
            messages.append({"role": "user", "content": "play that country's trending list"})
            messages.append({"role": "assistant", "content": "The trending tracks are now visible in the panel! Just click any song to play. 🎵"})

            # Example 3: Create artist playlist (NO playlist exists)
            messages.append({"role": "user", "content": "play some shakira"})
            messages.append({"role": "assistant", "content": "Coming right up! 💃 [ACTION:SHOW_SONG_LIST|Shakira]"})

            # Example 4: Ask about existing playlist - NO ACTION
            messages.append({"role": "user", "content": "what's in my shakira playlist?"})
            messages.append({"role": "assistant", "content": "Your Shakira playlist has 20 tracks! You can view all the songs by clicking on the playlist in the left panel. 💃"})

        # Add actual conversation history if it exists
        if conversation_history:
            messages.extend(conversation_history)

        # Add current user query
        messages.append({"role": "user", "content": query})

        # Don't catch exceptions here - let them propagate to main.py for fallback handling
        if self.provider == "openai":
            async for chunk in self._stream_openai(system_prompt, messages):
                yield chunk
        elif self.provider == "anthropic":
            async for chunk in self._stream_anthropic(system_prompt, messages):
                yield chunk
        else:
            yield "Error: Unsupported LLM provider"

    async def _stream_openai(self, system_prompt: str, messages: List[Dict]) -> AsyncGenerator[str, None]:
        """Stream from OpenAI"""
        full_messages = [
            {"role": "system", "content": system_prompt},
            *messages
        ]

        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=full_messages,
            stream=True,
            temperature=0.7,
            max_tokens=1000
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def _stream_anthropic(self, system_prompt: str, messages: List[Dict]) -> AsyncGenerator[str, None]:
        """Stream from Anthropic"""
        async with self.client.messages.stream(
            model=self.model,
            max_tokens=1000,
            system=system_prompt,
            messages=messages,
            temperature=0.7
        ) as stream:
            async for text in stream.text_stream:
                yield text
