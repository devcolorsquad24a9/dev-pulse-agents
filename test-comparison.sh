#!/bin/bash

BASE_URL="http://localhost:3000"

echo "🧪 Testing Comparison Agent End-to-End"
echo "======================================"

# Step 1: Health check
echo -e "\n1. Health Check..."
HEALTH=$(curl -s $BASE_URL/health)
echo "$HEALTH" | jq '.'
if [ $? -ne 0 ]; then
  echo "❌ Health check failed"
  exit 1
fi

# Step 2: Process first tool
echo -e "\n2. Processing Windsurf changelog..."
WINDSURF_RESULT=$(curl -s -X POST $BASE_URL/api/agents/web-search/process \
  -H "Content-Type: application/json" \
  -d '{
    "tools": [{"name": "windsurf", "url": "https://windsurf.com/changelog"}]
  }')
echo "$WINDSURF_RESULT" | jq '.'

# Wait a bit for processing
echo "   Waiting 5 seconds for processing..."
sleep 5

# Step 3: Process second tool
echo -e "\n3. Processing Cursor changelog..."
CURSOR_RESULT=$(curl -s -X POST $BASE_URL/api/agents/web-search/process \
  -H "Content-Type: application/json" \
  -d '{
    "tools": [{"name": "cursor", "url": "https://cursor.com/changelog"}]
  }')
echo "$CURSOR_RESULT" | jq '.'

# Wait for processing
echo "   Waiting 5 seconds for processing..."
sleep 5

# Step 4: Run comparison
echo -e "\n4. Running comparison (first time - will generate)..."
COMPARISON_RESULT=$(curl -s -X POST $BASE_URL/api/agents/comparison \
  -H "Content-Type: application/json" \
  -d '{
    "toolNames": ["windsurf", "cursor"]
  }')

echo "$COMPARISON_RESULT" | jq '.'

# Validate response structure
echo -e "\n5. Validating response structure..."
HAS_ID=$(echo "$COMPARISON_RESULT" | jq -e '.id' > /dev/null 2>&1 && echo "yes" || echo "no")
HAS_TOOL_NAMES=$(echo "$COMPARISON_RESULT" | jq -e '.toolNames' > /dev/null 2>&1 && echo "yes" || echo "no")
HAS_BLOB_PATH=$(echo "$COMPARISON_RESULT" | jq -e '.blobPath' > /dev/null 2>&1 && echo "yes" || echo "no")
HAS_CONTENT=$(echo "$COMPARISON_RESULT" | jq -e '.content' > /dev/null 2>&1 && echo "yes" || echo "no")
HAS_CREATED_AT=$(echo "$COMPARISON_RESULT" | jq -e '.createdAt' > /dev/null 2>&1 && echo "yes" || echo "no")

if [ "$HAS_ID" = "yes" ] && [ "$HAS_TOOL_NAMES" = "yes" ] && [ "$HAS_BLOB_PATH" = "yes" ] && [ "$HAS_CONTENT" = "yes" ] && [ "$HAS_CREATED_AT" = "yes" ]; then
  echo "✅ Response structure is valid"
  echo "   - id: $(echo "$COMPARISON_RESULT" | jq -r '.id')"
  echo "   - toolNames: $(echo "$COMPARISON_RESULT" | jq -r '.toolNames | join(", ")')"
  echo "   - blobPath: $(echo "$COMPARISON_RESULT" | jq -r '.blobPath')"
  CONTENT_LENGTH=$(echo "$COMPARISON_RESULT" | jq -r '.content | length')
  echo "   - content length: $CONTENT_LENGTH characters"
else
  echo "❌ Response structure validation failed"
  echo "   id: $HAS_ID, toolNames: $HAS_TOOL_NAMES, blobPath: $HAS_BLOB_PATH, content: $HAS_CONTENT, createdAt: $HAS_CREATED_AT"
  exit 1
fi

# Step 6: Test caching (should return same comparison faster)
echo -e "\n6. Testing cache (should return existing comparison)..."
COMPARISON_CACHED=$(curl -s -X POST $BASE_URL/api/agents/comparison \
  -H "Content-Type: application/json" \
  -d '{
    "toolNames": ["windsurf", "cursor"]
  }')

CACHED_ID=$(echo "$COMPARISON_CACHED" | jq -r '.id')
ORIGINAL_ID=$(echo "$COMPARISON_RESULT" | jq -r '.id')

if [ "$CACHED_ID" = "$ORIGINAL_ID" ]; then
  echo "✅ Cache working correctly (same ID: $CACHED_ID)"
else
  echo "⚠️  Cache returned different ID (original: $ORIGINAL_ID, cached: $CACHED_ID)"
fi

# Step 7: Verify content is not empty
echo -e "\n7. Verifying comparison content..."
CONTENT=$(echo "$COMPARISON_RESULT" | jq -r '.content')
if [ -z "$CONTENT" ] || [ "$CONTENT" = "null" ]; then
  echo "❌ Comparison content is empty"
  exit 1
else
  echo "✅ Comparison content exists ($CONTENT_LENGTH characters)"
  echo "   Preview (first 200 chars):"
  echo "$CONTENT" | head -c 200
  echo "..."
fi

echo -e "\n✅ All tests passed!"