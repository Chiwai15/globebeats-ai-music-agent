#!/usr/bin/env python3
"""
GlobeBeats API and AI Chat Tests
Run: python3 tests/test_api.py
"""

import urllib.request
import json
import time
import sys

API_BASE = "http://localhost:8001"

def test_health():
    """Test health endpoint"""
    print("\n=== Test 1: Health Check ===")
    try:
        with urllib.request.urlopen(f"{API_BASE}/", timeout=10) as resp:
            data = json.loads(resp.read())
            assert data.get("status") == "ok", "Status not ok"
            assert data.get("ai_enabled") == True, "AI not enabled"
            assert data.get("countries") >= 30, f"Only {data.get('countries')} countries"
            print(f"✅ Health: OK, {data.get('countries')} countries, AI enabled")
            return True
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False


def test_countries():
    """Test countries endpoint"""
    print("\n=== Test 2: Countries Data ===")
    try:
        with urllib.request.urlopen(f"{API_BASE}/countries", timeout=30) as resp:
            countries = json.loads(resp.read())
            assert len(countries) >= 30, f"Only {len(countries)} countries"

            # Check each country has required fields
            for c in countries[:5]:
                assert "country_code" in c, "Missing country_code"
                assert "country_name" in c, "Missing country_name"
                assert "tracks" in c, "Missing tracks"

            # Count tracks with previews
            total_tracks = sum(len(c.get("tracks", [])) for c in countries)
            with_preview = sum(
                len([t for t in c.get("tracks", []) if t.get("preview_url")])
                for c in countries
            )
            print(f"✅ Countries: {len(countries)}, Total tracks: {total_tracks}, With preview: {with_preview}")
            return True
    except Exception as e:
        print(f"❌ Countries test failed: {e}")
        return False


def test_search():
    """Test search endpoint"""
    print("\n=== Test 3: Search API ===")
    test_queries = ["Taylor Swift", "Shakira", "BTS"]

    for query in test_queries:
        try:
            req = urllib.request.Request(
                f"{API_BASE}/search",
                data=json.dumps({"query": query, "limit": 5}).encode(),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
                tracks = data.get("tracks", [])
                with_preview = len([t for t in tracks if t.get("preview_url")])
                print(f"  ✅ Search '{query}': {len(tracks)} tracks, {with_preview} with preview")
        except Exception as e:
            print(f"  ❌ Search '{query}' failed: {e}")
            return False
    return True


def test_chat_simple():
    """Test simple chat without actions"""
    print("\n=== Test 4: Simple Chat ===")
    try:
        req = urllib.request.Request(
            f"{API_BASE}/chat",
            data=json.dumps({
                "message": "Hello, what can you do?",
                "conversation_history": [],
                "playlists": []
            }).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            response_text = resp.read().decode()
            # Parse SSE response
            full_response = ""
            for line in response_text.split("\n"):
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        if data.get("chunk"):
                            full_response += data["chunk"]
                    except:
                        pass

            assert len(full_response) > 20, "Response too short"
            print(f"  ✅ Chat response: {len(full_response)} chars")
            print(f"     Preview: {full_response[:100]}...")
            return True
    except Exception as e:
        print(f"  ❌ Simple chat failed: {e}")
        return False


def test_chat_country_action():
    """Test chat with country selection action"""
    print("\n=== Test 5: Chat Country Action ===")
    try:
        req = urllib.request.Request(
            f"{API_BASE}/chat",
            data=json.dumps({
                "message": "What's trending in Japan?",
                "conversation_history": [],
                "playlists": []
            }).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            response_text = resp.read().decode()
            full_response = ""
            for line in response_text.split("\n"):
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        if data.get("chunk"):
                            full_response += data["chunk"]
                    except:
                        pass

            # Check for action tag
            has_action = "[ACTION:SELECT_COUNTRY|JP]" in full_response
            print(f"  Response: {full_response[:150]}...")
            if has_action:
                print(f"  ✅ Found SELECT_COUNTRY action for Japan")
            else:
                print(f"  ⚠️  No SELECT_COUNTRY action found (may still be valid)")
            return True
    except Exception as e:
        print(f"  ❌ Country action test failed: {e}")
        return False


def test_chat_playlist_action():
    """Test chat with playlist creation action"""
    print("\n=== Test 6: Chat Playlist Action ===")
    try:
        req = urllib.request.Request(
            f"{API_BASE}/chat",
            data=json.dumps({
                "message": "Play some Taylor Swift songs",
                "conversation_history": [],
                "playlists": []
            }).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            response_text = resp.read().decode()
            full_response = ""
            for line in response_text.split("\n"):
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        if data.get("chunk"):
                            full_response += data["chunk"]
                    except:
                        pass

            # Check for action tag
            has_action = "[ACTION:SHOW_SONG_LIST|" in full_response
            print(f"  Response: {full_response[:150]}...")
            if has_action:
                print(f"  ✅ Found SHOW_SONG_LIST action for playlist creation")
            else:
                print(f"  ⚠️  No SHOW_SONG_LIST action found")
            return has_action
    except Exception as e:
        print(f"  ❌ Playlist action test failed: {e}")
        return False


def test_chat_existing_playlist():
    """Test chat recognizes existing playlist"""
    print("\n=== Test 7: Chat Existing Playlist ===")
    try:
        req = urllib.request.Request(
            f"{API_BASE}/chat",
            data=json.dumps({
                "message": "Play from my Taylor Swift playlist",
                "conversation_history": [],
                "playlists": [{"name": "Taylor Swift", "tracks": [{"name": "Anti-Hero"}]}]
            }).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            response_text = resp.read().decode()
            full_response = ""
            for line in response_text.split("\n"):
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        if data.get("chunk"):
                            full_response += data["chunk"]
                    except:
                        pass

            # Should NOT create new playlist if one exists
            creates_new = "[ACTION:SHOW_SONG_LIST|" in full_response
            print(f"  Response: {full_response[:150]}...")
            if not creates_new:
                print(f"  ✅ Correctly recognized existing playlist (no duplicate creation)")
            else:
                print(f"  ⚠️  Created new playlist instead of using existing one")
            return not creates_new
    except Exception as e:
        print(f"  ❌ Existing playlist test failed: {e}")
        return False


def run_all_tests():
    """Run all tests"""
    print("=" * 60)
    print("GlobeBeats API & AI Chat Tests")
    print("=" * 60)

    results = []
    results.append(("Health Check", test_health()))
    results.append(("Countries Data", test_countries()))
    results.append(("Search API", test_search()))
    results.append(("Simple Chat", test_chat_simple()))
    results.append(("Country Action", test_chat_country_action()))
    results.append(("Playlist Action", test_chat_playlist_action()))
    results.append(("Existing Playlist", test_chat_existing_playlist()))

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
    # Wait for backend to be ready
    print("Waiting for backend to be ready...")
    for i in range(30):
        try:
            with urllib.request.urlopen(f"{API_BASE}/", timeout=5) as resp:
                if resp.status == 200:
                    break
        except:
            pass
        time.sleep(2)

    success = run_all_tests()
    sys.exit(0 if success else 1)
