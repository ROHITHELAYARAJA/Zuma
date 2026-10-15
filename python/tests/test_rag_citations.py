import unittest
from zuma_aws.rag import validate_draft

class CitationRegressionTests(unittest.TestCase):
    def test_more_than_four_valid_sources_are_supported(self):
        passages = {f"p{i}": {"text": f"Recorded vital sign {i}."} for i in range(6)}
        draft = {"sections": [{"heading": "Results", "claims": [{"text": "Several vital signs are recorded.", "evidenceIds": list(passages)}]}]}
        sections, claims, condensed = validate_draft(draft, passages)
        self.assertEqual(len(claims), 1)
        self.assertEqual(len(claims[0]["evidenceIds"]), 6)
        self.assertFalse(condensed)
        self.assertIn("Recorded vital sign 5.", sections[0]["claims"][0]["quote"])

    def test_unknown_source_does_not_discard_other_supported_claims(self):
        passages = {"p1": {"text": "Walnut allergy recorded."}}
        draft = {"sections": [{"heading": "Allergies", "claims": [{"text": "Walnut allergy recorded.", "evidenceIds": ["p1"]}, {"text": "Unsupported condition.", "evidenceIds": ["invented"]}]}]}
        sections, claims, condensed = validate_draft(draft, passages)
        self.assertTrue(condensed)
        self.assertEqual(len(claims), 1)
        self.assertEqual(len(sections[0]["claims"]), 1)
        self.assertEqual(claims[0]["quote"], "Walnut allergy recorded.")

    def test_all_invalid_references_leave_no_releasable_claim(self):
        draft = {"sections": [{"heading": "Overview", "claims": [{"text": "Unsupported claim.", "evidenceIds": ["wrong"]}]}]}
        sections, claims, condensed = validate_draft(draft, {"valid": {"text": "Source fact."}})
        self.assertEqual(claims, [])
        self.assertEqual(sections[0]["claims"], [])
        self.assertTrue(condensed)

if __name__ == "__main__":
    unittest.main()
