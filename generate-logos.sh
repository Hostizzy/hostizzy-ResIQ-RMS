#!/bin/bash
# Script to generate missing logo assets
# Requires ImageMagick (install: apt-get install imagemagick or brew install imagemagick)

cd assets/

# Check if logo.png exists
if [ ! -f "logo.png" ]; then
    echo "Error: logo.png not found!"
    exit 1
fi

# Generate missing logo sizes
echo "Generating logo-96.png..."
convert logo.png -resize 96x96 logo-96.png

echo "Generating logo-128.png..."
convert logo.png -resize 128x128 logo-128.png

echo "Generating logo-256.png..."
convert logo.png -resize 256x256 logo-256.png

echo "Generating logo-384.png..."
convert logo.png -resize 384x384 logo-384.png

echo "✅ All logos generated successfully!"
echo ""
echo "Generated files:"
ls -lh logo-96.png logo-128.png logo-256.png logo-384.png

