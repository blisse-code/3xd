#!/bin/bash
# generate-manifest.sh
# Scans the case-studies/ folder for .md files and generates manifest.json
# 
# Usage: ./generate-manifest.sh
#
# Each .md file should have YAML-style metadata at the top:
#   # Title
#   **Year:** 2021
#   **Type:** Product Design
#   **Domain:** EdTech
#
# The script extracts this metadata and builds the manifest.
# For full control, edit manifest.json directly.

set -e

CASE_DIR="case-studies"
MANIFEST="$CASE_DIR/manifest.json"

if [ ! -d "$CASE_DIR" ]; then
  echo "Error: $CASE_DIR directory not found."
  exit 1
fi

# Count markdown files (exclude manifest)
MD_FILES=$(find "$CASE_DIR" -name "*.md" -type f | sort)
COUNT=$(echo "$MD_FILES" | grep -c '.' || true)

if [ "$COUNT" -eq 0 ]; then
  echo "No .md files found in $CASE_DIR/"
  echo '{ "generated": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "studies": [] }' > "$MANIFEST"
  echo "Empty manifest written to $MANIFEST"
  exit 0
fi

echo "Found $COUNT case study file(s). Generating manifest..."

# Start JSON
echo '{' > "$MANIFEST"
echo '  "generated": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",' >> "$MANIFEST"
echo '  "studies": [' >> "$MANIFEST"

FIRST=true

for FILE in $MD_FILES; do
  FILENAME=$(basename "$FILE" .md)
  
  # Extract title (first H1)
  TITLE=$(grep -m1 '^# ' "$FILE" | sed 's/^# //')
  if [ -z "$TITLE" ]; then
    TITLE="$FILENAME"
  fi
  
  # Extract year
  YEAR=$(grep -m1 '\*\*Year:\*\*' "$FILE" | sed 's/.*\*\*Year:\*\* *//' | tr -d '[:space:]')
  
  # Extract type
  TYPE=$(grep -m1 '\*\*Type:\*\*' "$FILE" | sed 's/.*\*\*Type:\*\* *//')
  
  # Extract domain for tags
  DOMAIN=$(grep -m1 '\*\*Domain:\*\*' "$FILE" | sed 's/.*\*\*Domain:\*\* *//')
  
  # Build tags from domain
  TAGS=""
  if [ -n "$DOMAIN" ]; then
    # Split on / or , and trim
    IFS='/' read -ra PARTS <<< "$DOMAIN"
    for part in "${PARTS[@]}"; do
      part=$(echo "$part" | xargs) # trim whitespace
      if [ -n "$part" ]; then
        if [ -n "$TAGS" ]; then TAGS="$TAGS, "; fi
        TAGS="$TAGS\"$part\""
      fi
    done
  fi
  if [ -z "$TAGS" ]; then
    TAGS="\"UX Design\""
  fi
  
  # Extract first paragraph after --- as summary (simplified)
  SUMMARY=$(awk '/^## Context|^## The Real/{found=1;next} found && /^[A-Z]/{print;exit}' "$FILE" | head -c 200)
  if [ -z "$SUMMARY" ]; then
    SUMMARY="Case study for $TITLE"
  fi
  # Escape quotes in summary
  SUMMARY=$(echo "$SUMMARY" | sed 's/"/\\"/g')
  
  # Check for thumbnail
  THUMB="null"
  if [ -f "$CASE_DIR/${FILENAME}-thumb.jpg" ]; then
    THUMB="\"$CASE_DIR/${FILENAME}-thumb.jpg\""
  elif [ -f "$CASE_DIR/${FILENAME}-thumb.png" ]; then
    THUMB="\"$CASE_DIR/${FILENAME}-thumb.png\""
  fi
  
  # Append JSON entry
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    echo '    ,' >> "$MANIFEST"
  fi
  
  cat >> "$MANIFEST" << ENTRY
    {
      "id": "$FILENAME",
      "title": "$TITLE",
      "year": "$YEAR",
      "type": "$TYPE",
      "summary": "$SUMMARY",
      "tags": [$TAGS],
      "thumbnail": $THUMB,
      "file": "$CASE_DIR/$FILENAME.md"
    }
ENTRY

done

echo '  ]' >> "$MANIFEST"
echo '}' >> "$MANIFEST"

echo "Manifest generated: $MANIFEST ($COUNT studies)"
