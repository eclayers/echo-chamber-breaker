import "dotenv/config";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

async function verifyBedrock() {
  console.log("=============================================================");
  console.log("⚡ Echo Chamber Breaker — Amazon Bedrock Connectivity Checker");
  console.log("=============================================================");

  const region = process.env.AWS_REGION || "us-east-1";
  const modelId = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-5-sonnet-20241022-v2:0";
  const hasKey = Boolean(process.env.AWS_ACCESS_KEY_ID);
  const hasSecret = Boolean(process.env.AWS_SECRET_ACCESS_KEY);

  console.log(`📍 Configured Region: ${region}`);
  console.log(`🤖 Target Model ID:  ${modelId}`);
  console.log(`🔑 AWS Key Present:  ${hasKey ? "YES" : "NO"}`);
  console.log(`🔒 AWS Secret Set:   ${hasSecret ? "YES" : "NO"}`);

  const isPlaceholder =
    process.env.AWS_ACCESS_KEY_ID?.includes("your_aws_access_key") ||
    process.env.AWS_SECRET_ACCESS_KEY?.includes("your_aws_secret_access");

  if (!hasKey || !hasSecret || isPlaceholder || modelId === "mock") {
    console.log("\n💡 Status: System is currently configured in ZERO-CONFIG MOCK MODE.");
    if (isPlaceholder) {
      console.log("   ⚠️  Placeholder values detected in .env.");
    }
    console.log("   The server functions 100% locally and offline without AWS charges.");
    console.log("\n👉 To connect live Amazon Bedrock:");
    console.log("   1. Open .env");
    console.log("   2. Replace AWS_ACCESS_KEY_ID with your real AWS Access Key");
    console.log("   3. Replace AWS_SECRET_ACCESS_KEY with your real AWS Secret Key");
    console.log("   4. Verify BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0");
    console.log("   5. Re-run: npm run test:bedrock");
    console.log("=============================================================\n");
    return;
  }

  console.log("\n📡 Sending test inference payload to Amazon Bedrock...");
  const client = new BedrockRuntimeClient({ region });

  const startTime = Date.now();
  try {
    const isNova = modelId.includes("nova");
    const payload = isNova
      ? {
          messages: [
            {
              role: "user",
              content: [{ text: "Steelman this claim in 30 words: 'Remote work ruins company culture.'" }],
            },
          ],
          inferenceConfig: {
            max_new_tokens: 300,
            temperature: 0.2,
          },
        }
      : {
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: "Steelman this claim in 30 words: 'Remote work ruins company culture.'",
            },
          ],
        };

    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const res = await client.send(command);
    const latency = Date.now() - startTime;
    const bodyStr = new TextDecoder().decode(res.body);
    const parsed = JSON.parse(bodyStr);
    const textOutput = isNova
      ? parsed.output?.message?.content?.[0]?.text
      : parsed.content?.[0]?.text;

    console.log(`\n✅ BEDROCK INFERENCE SUCCESSFUL! (${latency}ms roundtrip)`);
    console.log("-------------------------------------------------------------");
    console.log("Model Output:");
    console.log(textOutput || bodyStr);
    console.log("-------------------------------------------------------------");
    console.log("🎉 Ready for AWS Builder Mini-Challenge submission!");
  } catch (err: any) {
    console.error(`\n❌ Bedrock Connection Error: ${err.message}`);
    if (err.name === "AccessDeniedException") {
      console.log("\n⚠️  IAM Tip: Ensure your AWS IAM user or role has the following permission:");
      console.log('   "Action": "bedrock:InvokeModel",');
      console.log(`   "Resource": "arn:aws:bedrock:${region}::foundation-model/${modelId}"`);
    }
  }
}

verifyBedrock();
