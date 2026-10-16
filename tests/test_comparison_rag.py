import hashlib
import unittest
from unittest.mock import MagicMock, patch
from zuma_aws.comparison import answer_comparison, ingest_comparison


class ComparisonRetrievalTests(unittest.TestCase):
    def setUp(self):
        text = "Synthetic clinical evidence. Not a real patient. Metformin 500 mg once daily."
        self.record = {"id": "cite-b-medication-02", "recordId": "record-b-medication-02", "hospitalId": "B", "version": 1, "category": "medication", "text": text, "sha256": hashlib.sha256(text.encode()).hexdigest()}
        self.payload = {"patientId": "ravi", "sourceVersion": "version-1", "question": "What medicine was recorded?", "records": [self.record]}
        self.metadata = {"patient_id": "ravi", "synthetic": True, "record_id": self.record["recordId"], "hospital_id": "B", "version": 1, "category": "medication", "content_sha256": self.record["sha256"]}
        self.aws = MagicMock()
        self.session = patch("zuma_aws.comparison.session", return_value=self.aws).start()
        self.env = patch.dict("os.environ", {"BEDROCK_KNOWLEDGE_BASE_ID": "ABCDEFGHIJ", "BEDROCK_TEXT_MODEL_ID": "test-model"}).start()
        self.addCleanup(patch.stopall)

    def matches(self, metadata):
        self.aws.client.return_value.retrieve.return_value = {"retrievalResults": [{"metadata": metadata, "content": {"text": self.record["text"]}}]}

    def test_other_patient_or_stale_hash_cannot_be_used(self):
        for changes in ({"patient_id": "sonu"}, {"content_sha256": "0" * 64}, {"version": 2}, {"hospital_id": "A"}):
            with self.subTest(changes=changes):
                self.matches({**self.metadata, **changes})
                with self.assertRaisesRegex(ValueError, "NO_VERIFIED_KNOWLEDGE_BASE_EVIDENCE"):
                    answer_comparison(self.payload)

    def test_matching_record_still_requires_claim_support(self):
        self.matches(self.metadata)
        draft = {"sections": [{"heading": "Medicine", "claims": [{"text": "Hospital B recorded Metformin 500 mg once daily.", "evidenceIds": [self.record["id"]]}]}]}
        with patch("zuma_aws.comparison.model_json", side_effect=[draft, {"supported": [True]}]):
            answer = answer_comparison(self.payload)
        self.assertEqual(answer["evidenceIds"], [self.record["id"]])
        self.assertEqual(answer["sourceVersion"], "version-1")
        self.assertEqual(answer["mode"], "bedrock-kb")

    def test_unsupported_claim_fails_closed(self):
        self.matches(self.metadata)
        draft = {"sections": [{"heading": "Medicine", "claims": [{"text": "Change the medicine.", "evidenceIds": [self.record["id"]]}]}]}
        with patch("zuma_aws.comparison.model_json", side_effect=[draft, {"supported": [False]}]):
            with self.assertRaisesRegex(ValueError, "SUMMARY_REQUIRES_EVIDENCE_REVIEW"):
                answer_comparison(self.payload)

    def test_ingestion_cannot_write_outside_comparison_prefix(self):
        with patch.dict("os.environ", {"S3_KMS_KEY_ID": "test"}):
            with self.assertRaisesRegex(ValueError, "INVALID_COMPARISON_EVIDENCE_PATH"):
                ingest_comparison([{"key": "raw/abdm/overwrite.html", "metadataKey": "raw/abdm/overwrite.html.metadata.json", "html": "test", "metadata": "{}"}])


if __name__ == "__main__":
    unittest.main()
