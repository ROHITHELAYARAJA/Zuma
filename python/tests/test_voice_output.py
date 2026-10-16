import base64
import io
import unittest
import wave
from unittest.mock import AsyncMock, patch
from zuma_aws.voice import speech_answer

class NovaAudioTests(unittest.IsolatedAsyncioTestCase):
    async def test_combines_all_verified_nova_audio_segments(self):
        async def grounded(question):
            return {"answer": "Allergies\nWalnut allergy recorded. [1]\nReview the source. [2]"}
        events = [{"user": ["What allergies are recorded?"]}, {"turns": [
            {"text": "Allergies. Walnut allergy recorded.", "audio": b"\x01\x00" * 20},
            {"text": "Review the source.", "audio": b"\x02\x00" * 30}]}]
        with patch.dict("os.environ", {"AWS_CLOUD_ENABLED": "true"}), patch("zuma_aws.voice.exchange", new=AsyncMock(side_effect=events)):
            result = await speech_answer(b"\x00\x00", grounded)
        self.assertEqual(result["voiceProvider"], "nova-strict")
        with wave.open(io.BytesIO(base64.b64decode(result["audioBase64"]))) as audio:
            self.assertEqual(audio.getframerate(), 24000)
            self.assertEqual(audio.readframes(50), b"\x01\x00" * 20 + b"\x02\x00" * 30)

    async def test_rejects_audio_that_adds_an_unsupported_statement(self):
        async def grounded(question): return {"answer": "Walnut allergy recorded."}
        with patch.dict("os.environ", {"AWS_CLOUD_ENABLED": "true"}), patch("zuma_aws.voice.exchange", new=AsyncMock(side_effect=[{"user": ["Allergies?"]}, {"turns": [{"text": "No allergies.", "audio": b"\x00\x00"}]}])):
            with self.assertRaisesRegex(ValueError, "SPOKEN_RESPONSE_DID_NOT_MATCH_VERIFIED_TEXT"):
                await speech_answer(b"\x00\x00", grounded)
