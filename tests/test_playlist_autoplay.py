#!/usr/bin/env python3
"""
Test: AI Playlist Creation and Auto-Play
Tests that when user asks "Play some Taylor Swift", a playlist is created AND music starts playing.
"""

import asyncio
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:5174"


async def test_taylor_swift_playlist_autoplay():
    """Test the complete flow: Ask AI -> Create playlist -> Auto-play first track"""
    print("=" * 60)
    print("Testing: AI Playlist Auto-Play")
    print("=" * 60)

    async with async_playwright() as p:
        # Launch browser with audio enabled
        browser = await p.chromium.launch(
            headless=False,  # Use headed mode to see what's happening
            args=['--autoplay-policy=no-user-gesture-required']  # Allow audio autoplay
        )
        context = await browser.new_context()
        page = await context.new_page()

        # Collect console logs
        logs = []
        page.on('console', lambda msg: logs.append(f"[{msg.type}] {msg.text}"))

        try:
            # Step 1: Load page
            print("\n1. Loading page...")
            await page.goto(BASE_URL, timeout=60000)
            await page.wait_for_timeout(3000)
            print("   ✓ Page loaded")

            # Step 2: Click to unlock audio
            print("\n2. Clicking to unlock audio...")
            await page.click('body')
            await page.wait_for_timeout(1000)
            print("   ✓ Audio unlocked")

            # Step 3: Open AI chat
            print("\n3. Opening AI chat...")
            # Try multiple selectors
            chat_opened = False
            for selector in ['button:has-text("Ask")', 'text=Ask AI', '[title*="Chat"]']:
                try:
                    btn = page.locator(selector).first
                    if await btn.is_visible(timeout=2000):
                        await btn.click()
                        chat_opened = True
                        break
                except:
                    continue

            if not chat_opened:
                # Try clicking the chat toggle button (bottom right)
                await page.click('button.fixed.bottom-\\[26px\\]')
                chat_opened = True

            await page.wait_for_timeout(1000)
            print("   ✓ Chat opened")

            # Step 4: Click the suggested question "Play some Taylor Swift"
            print("\n4. Clicking suggested question 'Play some Taylor Swift'...")

            # Find and click the suggested question button in the chat panel
            # The chat panel should have example question buttons
            taylor_button = page.locator('button:has-text("Play some Taylor Swift")').first
            if await taylor_button.is_visible(timeout=3000):
                await taylor_button.click()
                print("   ✓ Clicked suggested question")
            else:
                # Fallback: find input inside the chat panel (bottom-right fixed div)
                print("   Suggested question not found, typing manually...")
                chat_panel = page.locator('.fixed.bottom-\\[86px\\]').or_(page.locator('[class*="chat"]'))
                chat_input = chat_panel.locator('input').first
                await chat_input.fill("Play some Taylor Swift")
                await chat_input.press('Enter')
                print("   ✓ Message sent manually")

            # Step 5: Wait for response and playlist creation
            print("\n5. Waiting for AI response and playlist creation...")
            await page.wait_for_timeout(15000)  # Wait longer for API call and response

            # Check for playlist creation message
            page_content = await page.content()
            playlist_created = "Created playlist" in page_content or "Taylor Swift" in page_content

            if playlist_created:
                print("   ✓ Playlist created")
            else:
                print("   ✗ Playlist NOT created")

            # Step 6: Check if music is playing
            print("\n6. Checking if music is playing...")
            await page.wait_for_timeout(3000)

            # Check AudioManager state via console
            audio_state = await page.evaluate("""
                () => {
                    // Check for any audio elements
                    const audios = document.querySelectorAll('audio');
                    let playing = 0;
                    audios.forEach(a => {
                        if (!a.paused && a.currentTime > 0) playing++;
                    });

                    // Check MusicPlayer visibility
                    const musicPlayer = document.querySelector('[class*="MusicPlayer"]') ||
                                        document.querySelector('.fixed.bottom-0');

                    return {
                        audioElements: audios.length,
                        playingCount: playing,
                        hasMusicPlayer: !!musicPlayer
                    };
                }
            """)

            print(f"   Audio elements: {audio_state['audioElements']}")
            print(f"   Playing count: {audio_state['playingCount']}")

            # Check console logs for AudioManager and ChatPanel activity
            audio_logs = [l for l in logs if 'AudioManager' in l or 'handlePlaySong' in l or 'play()' in l or 'ChatPanel' in l]
            print(f"\n7. Relevant console logs ({len(audio_logs)} found):")
            for log in audio_logs[-15:]:
                print(f"   {log}")

            # Also show ChatPanel specific logs
            chatpanel_logs = [l for l in logs if 'ChatPanel' in l]
            print(f"\n8. ChatPanel logs ({len(chatpanel_logs)} found):")
            for log in chatpanel_logs:
                print(f"   {log}")

            # Check for specific success/failure indicators
            play_called = any('Calling play()' in l for l in logs)
            play_success = any('Playback started' in l for l in logs)
            play_failed = any('Play failed' in l for l in logs)

            print("\n" + "=" * 60)
            print("RESULTS:")
            print("=" * 60)
            print(f"  Playlist created: {'✓' if playlist_created else '✗'}")
            print(f"  play() was called: {'✓' if play_called else '✗'}")
            print(f"  Playback started: {'✓' if play_success else '✗'}")
            print(f"  Play failed: {'✓ (BAD)' if play_failed else '✗ (Good)'}")

            if not play_called:
                print("\n⚠️  ISSUE: play() was never called!")
                print("   This means the auto-play logic in ChatPanel isn't triggering.")

            if play_called and not play_success:
                print("\n⚠️  ISSUE: play() was called but playback didn't start!")
                print("   Check AudioManager for errors.")

            # Wait for user to see the browser
            print("\n\nBrowser will close in 10 seconds...")
            await page.wait_for_timeout(10000)

        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()

        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(test_taylor_swift_playlist_autoplay())
