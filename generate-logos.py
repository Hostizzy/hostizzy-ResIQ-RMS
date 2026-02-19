#!/usr/bin/env python3
"""
Script to generate missing logo assets
Requires Pillow: pip install Pillow
"""

from PIL import Image
import os

def resize_logo(input_path, output_path, size):
    """Resize logo to specified size"""
    try:
        with Image.open(input_path) as img:
            img_resized = img.resize((size, size), Image.Resampling.LANCZOS)
            img_resized.save(output_path, 'PNG', optimize=True)
            print(f"✅ Generated {output_path}")
    except Exception as e:
        print(f"❌ Error generating {output_path}: {e}")

def main():
    # Change to assets directory
    os.chdir('assets')
    
    input_logo = 'logo.png'
    
    if not os.path.exists(input_logo):
        print(f"❌ Error: {input_logo} not found!")
        return
    
    # Generate missing sizes
    sizes = {
        'logo-96.png': 96,
        'logo-128.png': 128,
        'logo-256.png': 256,
        'logo-384.png': 384
    }
    
    print("Generating logo assets...")
    for filename, size in sizes.items():
        resize_logo(input_logo, filename, size)
    
    print("\n✅ All logos generated successfully!")

if __name__ == '__main__':
    main()
