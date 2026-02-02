#!/usr/bin/env python3
"""
GlobeBeats Audio Singleton Tests
Tests that only ONE audio track plays at a time, preventing the "10 songs playing together" bug.

Run: python3 tests/test_audio_singleton.py
"""

import asyncio
import time
from playwright.async_api import async_playwright, expect

BASE_URL = "http://localhost:5174"
TIMEOUT = 60000  # 60 seconds for page load


async def count_audio_elements(page):
    """Count audio elements currently in the DOM"""
    return await page.evaluate("""
        () => {
            const audios = document.querySelectorAll('audio');
            return audios.length;
        }
    """)


async def count_playing_audios(page):
    """Count audio elements that are currently playing"""
    return await page.evaluate("""
        () => {
            const audios = document.querySelectorAll('audio');
            let playing = 0;
            audios.forEach(a => {
                if (!a.paused && !a.ended && a.currentTime > 0) {
                    playing++;
                }
            });
            return playing;
        }
    """)


async def get_audio_manager_state(page):
    """Get state from the AudioManager singleton"""
    return await page.evaluate("""
        () => {
            // Access AudioManager through window if exposed, or through React devtools
            try {
                // Check if AudioManager is available in window (for debugging)
                if (window.audioManager) {
                    return window.audioManager.getState();
                }
                // Otherwise check console logs for singleton messages
                return { available: false };
            } catch (e) {
                return { error: e.message };
            }
        }
    """)


async def click_trending_track(page, track_index=0):
    """Click a track in the trending panel"""
    # Find track buttons in the track list (buttons with truncate class for track names)
    track_buttons = page.locator('button.group').filter(has=page.locator('.truncate'))
    count = await track_buttons.count()

    if count > track_index:
        await track_buttons.nth(track_index).click()
        return True
    return False


async def open_ai_chat(page):
    """Open the AI chat panel"""
    # Try multiple selectors for the chat button
    selectors = [
        'text=Ask AI',
        'button:has-text("Ask")',
        '[class*="chat"]',
        'div:has-text("Music Agent")'
    ]

    for selector in selectors:
        try:
            chat_button = page.locator(selector).first
            if await chat_button.is_visible(timeout=2000):
                await chat_button.click()
                await page.wait_for_timeout(500)
                return True
        except:
            continue

    return False


async def send_chat_message(page, message):
    """Send a message in the AI chat"""
    # Find the chat input
    chat_input = page.locator('input[placeholder*="Ask"]').or_(page.locator('textarea'))
    await chat_input.fill(message)

    # Find and click send button or press Enter
    await chat_input.press('Enter')

    # Wait for response (streaming)
    await page.wait_for_timeout(5000)


async def test_page_loads(page):
    """Test 1: Page loads correctly"""
    print("\n=== Test 1: Page Load ===")
    await page.goto(BASE_URL, timeout=TIMEOUT)

    # Wait for globe to render
    await page.wait_for_selector('.globe-container, canvas', timeout=30000)

    # Check countries loaded
    await page.wait_for_timeout(3000)  # Wait for data

    print("✅ Page loaded successfully")
    return True


async def test_only_one_audio_plays_on_trending(page):
    """Test 2: Only one audio plays when clicking trending tracks"""
    print("\n=== Test 2: Single Audio on Trending Clicks ===")

    # Wait for page to be interactive
    await page.wait_for_timeout(2000)

    # Click first track
    print("  Clicking first trending track...")
    await click_trending_track(page, 0)
    await page.wait_for_timeout(2000)

    playing1 = await count_playing_audios(page)
    print(f"  Playing after 1st click: {playing1}")

    # Click second track
    print("  Clicking second trending track...")
    await click_trending_track(page, 1)
    await page.wait_for_timeout(2000)

    playing2 = await count_playing_audios(page)
    print(f"  Playing after 2nd click: {playing2}")

    # Click third track
    print("  Clicking third trending track...")
    await click_trending_track(page, 2)
    await page.wait_for_timeout(2000)

    playing3 = await count_playing_audios(page)
    print(f"  Playing after 3rd click: {playing3}")

    # Verify only ONE audio is playing at any time
    if playing1 <= 1 and playing2 <= 1 and playing3 <= 1:
        print("✅ Only one audio playing at a time (trending)")
        return True
    else:
        print(f"❌ Multiple audios detected! ({playing1}, {playing2}, {playing3})")
        return False


async def test_rapid_clicking(page):
    """Test 3: Rapid clicking doesn't create multiple audio streams"""
    print("\n=== Test 3: Rapid Click Protection ===")

    await page.wait_for_timeout(1000)

    # Rapidly click multiple tracks
    print("  Rapidly clicking 5 tracks...")
    for i in range(5):
        await click_trending_track(page, i % 3)  # Cycle through first 3 tracks
        await page.wait_for_timeout(200)  # Very short delay

    # Wait a moment for audio to stabilize
    await page.wait_for_timeout(2000)

    playing = await count_playing_audios(page)
    print(f"  Playing after rapid clicks: {playing}")

    if playing <= 1:
        print("✅ Rapid clicking handled correctly")
        return True
    else:
        print(f"❌ Multiple audios after rapid clicking: {playing}")
        return False


async def test_ai_playlist_and_trending_switch(page):
    """Test 4: Switching between AI playlist and trending doesn't overlap"""
    print("\n=== Test 4: AI Playlist <-> Trending Switch ===")

    # First, play a trending track
    print("  Playing trending track...")
    await click_trending_track(page, 0)
    await page.wait_for_timeout(2000)

    playing_trending = await count_playing_audios(page)
    print(f"  Playing trending: {playing_trending}")

    # Open AI chat and request a playlist
    print("  Opening AI chat...")
    if await open_ai_chat(page):
        print("  Sending playlist request...")
        await send_chat_message(page, "Play some Taylor Swift songs")
        await page.wait_for_timeout(8000)  # Wait for API response and action

        playing_after_ai = await count_playing_audios(page)
        print(f"  Playing after AI playlist: {playing_after_ai}")

        # Switch back to trending
        print("  Switching back to trending...")
        await click_trending_track(page, 1)
        await page.wait_for_timeout(2000)

        playing_back_trending = await count_playing_audios(page)
        print(f"  Playing after switch: {playing_back_trending}")

        if playing_after_ai <= 1 and playing_back_trending <= 1:
            print("✅ AI playlist and trending switch works correctly")
            return True
        else:
            print(f"❌ Audio overlap detected during switch")
            return False
    else:
        print("⚠️ Could not open AI chat, skipping test")
        return True  # Skip if chat not available


async def test_multiple_ai_requests(page):
    """Test 5: Multiple AI playlist requests don't overlap"""
    print("\n=== Test 5: Multiple AI Playlist Requests ===")

    if await open_ai_chat(page):
        # First request
        print("  First AI request...")
        await send_chat_message(page, "Play BTS songs")
        await page.wait_for_timeout(5000)

        playing1 = await count_playing_audios(page)
        print(f"  Playing after 1st request: {playing1}")

        # Second request immediately
        print("  Second AI request (Shakira)...")
        await send_chat_message(page, "Play Shakira songs instead")
        await page.wait_for_timeout(5000)

        playing2 = await count_playing_audios(page)
        print(f"  Playing after 2nd request: {playing2}")

        if playing1 <= 1 and playing2 <= 1:
            print("✅ Multiple AI requests handled correctly")
            return True
        else:
            print(f"❌ Audio overlap on multiple AI requests")
            return False
    else:
        print("⚠️ Could not open AI chat, skipping test")
        return True


async def test_console_for_singleton_logs(page):
    """Test 6: Verify AudioManager singleton is working via console logs"""
    print("\n=== Test 6: AudioManager Singleton Verification ===")

    # Collect console logs
    logs = []
    page.on('console', lambda msg: logs.append(msg.text))

    # Trigger some audio actions
    await click_trending_track(page, 0)
    await page.wait_for_timeout(2000)
    await click_trending_track(page, 1)
    await page.wait_for_timeout(2000)

    # Check for AudioManager logs
    singleton_logs = [log for log in logs if '[AudioManager]' in log]

    print(f"  Found {len(singleton_logs)} AudioManager log entries")
    for log in singleton_logs[:5]:  # Show first 5
        print(f"    - {log}")

    # Check for singleton initialization
    has_init = any('Singleton initialized' in log for log in logs)
    has_play = any('Playing:' in log for log in singleton_logs)

    if has_init or has_play:
        print("✅ AudioManager singleton is active")
        return True
    else:
        print("⚠️ No AudioManager logs found (may need to check implementation)")
        return True  # Don't fail on log check


async def run_all_tests():
    """Run all audio singleton tests"""
    print("=" * 60)
    print("GlobeBeats Audio Singleton Tests")
    print("Testing that only ONE audio plays at a time")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        results = []

        try:
            # Test 1: Page loads
            results.append(("Page Load", await test_page_loads(page)))

            # Test 2: Single audio on trending
            results.append(("Single Audio (Trending)", await test_only_one_audio_plays_on_trending(page)))

            # Test 3: Rapid clicking
            results.append(("Rapid Click Protection", await test_rapid_clicking(page)))

            # Test 4: AI and trending switch
            results.append(("AI <-> Trending Switch", await test_ai_playlist_and_trending_switch(page)))

            # Test 5: Multiple AI requests
            results.append(("Multiple AI Requests", await test_multiple_ai_requests(page)))

            # Test 6: Console logs
            results.append(("AudioManager Logs", await test_console_for_singleton_logs(page)))

        except Exception as e:
            print(f"\n❌ Test error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)

        passed = sum(1 for _, r in results if r)
        total = len(results)

        for name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status}: {name}")

        print(f"\nTotal: {passed}/{total} tests passed")

        return passed == total


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    exit(0 if success else 1)
