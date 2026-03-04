#!/bin/bash
# Script to generate missing logo assets
# Requires ImageMagick (install: apt-get install imagemagick or brew install imagemagick)

cd assets/

# Check if logo.png exists
if [ ! -f "logo.png" ]; then
    echo "Error: logo.png not found!"
    exit 1
fi

# Generate all required square logo sizes
echo "Generating logo-96.png..."
convert logo.png -resize 96x96 logo-96.png

echo "Generating logo-120.png..."
convert logo.png -resize 120x120 logo-120.png

echo "Generating logo-128.png..."
convert logo.png -resize 128x128 logo-128.png

echo "Generating logo-132.png..."
convert logo.png -resize 132x132 logo-132.png

echo "Generating logo-152.png..."
convert logo.png -resize 152x152 logo-152.png

echo "Generating logo-167.png..."
convert logo.png -resize 167x167 logo-167.png

echo "Generating logo-180.png..."
convert logo.png -resize 180x180 logo-180.png

echo "Generating logo-256.png..."
convert logo.png -resize 256x256 logo-256.png

echo "Generating logo-384.png..."
convert logo.png -resize 384x384 logo-384.png

echo "✅ All logos generated successfully!"
echo ""
echo "Generated files:"
ls -lh logo-96.png logo-120.png logo-128.png logo-132.png logo-152.png logo-167.png logo-180.png logo-256.png logo-384.png

