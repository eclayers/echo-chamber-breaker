# Amazon Bedrock Integration Guide (AWS Builder Mini-Challenge)

Echo Chamber Breaker is fully wired to invoke **Amazon Bedrock** foundational reasoning models (such as `anthropic.claude-3-5-sonnet-20241022-v2:0` or `amazon.nova-pro-v1:0`) to perform deep cognitive steelmanning and bias identification.

---

## 1. Prerequisites

1. An active AWS Account with Amazon Bedrock model access enabled in your target region (e.g. `us-east-1` or `us-west-2`).
2. An IAM User or Role with the following policy attached:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 2. Configuration

Create or update `.env` in the project root:

```env
# AWS Bedrock Authentication
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Choose model:
# Claude 3.5 Sonnet:
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Or Amazon Nova Pro:
# BEDROCK_MODEL_ID=amazon.nova-pro-v1:0
```

---

## 3. Verification

Run the automated Bedrock connectivity verification script:

```bash
npm run test:bedrock
```

When credentials are valid, the script will output:
```
✅ BEDROCK INFERENCE SUCCESSFUL! (642ms roundtrip)
-------------------------------------------------------------
Raw Response:
Distributed asynchronous teams replace fragile hallway consensus with durable, written processes, accessing specialized global talent impossible to recruit within a physical commute radius.
-------------------------------------------------------------
🎉 Ready for AWS Builder Mini-Challenge submission!
```

---

## 4. Fallback Architecture

If AWS credentials expire or Bedrock encounters network throttling, `src/services/bedrockAdapter.ts` automatically catches the exception and falls back gracefully to the embedded deterministic cognitive engine, ensuring zero service disruption or crashes for users and judges.
