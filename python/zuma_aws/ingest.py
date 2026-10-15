import hashlib
import html
import json
import os
from pathlib import Path
import boto3
from .rag import facts_for

def main():
    root = Path.cwd()
    session = boto3.Session(region_name=os.environ.get("AWS_REGION", "us-east-1"))
    s3 = session.client("s3")
    bucket = os.environ["S3_REPORT_BUCKET"]
    for report in json.loads((root / "data/abdm/dataset.json").read_text())["reports"]:
        raw = s3.get_object(Bucket=bucket, Key="raw/abdm/" + report["file"])["Body"].read()
        if hashlib.sha256(raw).hexdigest() != report["sha256"]:
            raise ValueError("S3_SOURCE_CHANGED")
        report["bundle"] = json.loads(raw)
        facts = facts_for(report)
        statements = [f["quote"] for f in facts]
        codes = {}
        for entry in report["bundle"]["entry"]:
            for coding in entry["resource"].get("code", {}).get("coding", []):
                key = (coding.get("system"), coding.get("code"))
                codes.setdefault(key, set()).add(coding.get("display", ""))
        conflicts = [sorted(x) for x in codes.values() if len(x) > 1]
        if conflicts:
            statements.append("Review needed: the same terminology code is reused with conflicting labels " + "; ".join(", ".join(x) for x in conflicts) + ". The source labels must not be treated as clinically validated diagnoses or silently corrected.")
        statements.append("This is a public NHA GitHub repository sample report, not a live hospital patient record. Hospital A and Hospital B assignments are local test roles. The two repository reports refer to different patients and must not be merged. Only retrieved report evidence is available; this is not a complete medical history.")
        if len(str(report.get("birthDate", ""))) < 10:
            statements.append("Only the birth year is documented; the day and month are not provided.")
        document = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Repository sample ' + html.escape(report["name"]) + '</title><body><h1>' + html.escape(report["name"]) + '</h1>' + ''.join('<p>' + html.escape(x) + '</p>' for x in statements) + '</body></html>'
        path = root / "data/abdm/evidence" / (report["reportId"] + ".html")
        path.write_text(document, encoding="utf-8")
        meta = Path(str(path) + ".metadata.json")
        data = json.loads(meta.read_text())
        data["metadataAttributes"]["evidence_format"] = {"value": {"type": "STRING", "stringValue": "readable-v2"}, "includeForEmbedding": False}
        meta.write_text(json.dumps(data, indent=2) + "\n")
        for file in (path, meta):
            s3.put_object(Bucket=bucket, Key="evidence/" + file.name, Body=file.read_bytes(), ContentType="text/html" if file.suffix == ".html" else "application/json", ServerSideEncryption="aws:kms", SSEKMSKeyId=os.environ["S3_KMS_KEY_ID"])
        print(report["reportId"], "uploaded", len(facts), "readable facts from encrypted S3 raw source")
    job = session.client("bedrock-agent").start_ingestion_job(knowledgeBaseId=os.environ["BEDROCK_KNOWLEDGE_BASE_ID"], dataSourceId=os.environ["BEDROCK_DATA_SOURCE_ID"], description="Readable evidence v2 for source-linked English summaries")["ingestionJob"]
    print("INGESTION", job["ingestionJobId"], job["status"])

if __name__ == "__main__":
    main()
