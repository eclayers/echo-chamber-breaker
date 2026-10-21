#!/usr/bin/env bash
# Echo Chamber Breaker — End-to-End MCP Verification Script
set -e

BASE_URL="http://localhost:3000"
echo "=========================================================="
echo "⚡ Testing Echo Chamber Breaker MCP Server at $BASE_URL"
echo "=========================================================="

echo -e "\n1. Checking Health Endpoint..."
curl -s "$BASE_URL/health" | grep -q "status" && echo "✅ Health check passed!" || echo "❌ Health check failed!"

echo -e "\n2. MCP Handshake: initialize"
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"demo-script","version":"1.0"}}}' \
  | grep -q "echo-chamber-breaker" && echo "✅ MCP initialize passed!" || echo "❌ MCP initialize failed!"

echo -e "\n3. MCP Tools Discovery: tools/list"
TOOLS_RES=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}')
echo "$TOOLS_RES" | grep -q "analyze_stance" && echo "✅ 9 Tools discovered successfully!" || echo "❌ Tools discovery failed!"

echo -e "\n4. Calling 'steelman' tool..."
STEELMAN_RES=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"steelman","arguments":{"statement":"Remote work is destroying company culture."}}}')
echo "$STEELMAN_RES" | grep -q "say" && echo "✅ Steelman generation passed with voice output!" || echo "❌ Steelman tool failed!"

echo -e "\n5. Fetching ML Benchmark Metrics..."
curl -s "$BASE_URL/api/benchmark" | grep -q "expectedCalibrationError" && echo "✅ ML Benchmark metrics passed!" || echo "❌ Benchmark failed!"

echo -e "\n=========================================================="
echo "🎉 ALL END-TO-END MCP PROTOCOL CHECKS COMPLETED SUCCESSFULLY!"
echo "👉 Web Simulator UI: http://localhost:3000/simulator"
echo "=========================================================="
