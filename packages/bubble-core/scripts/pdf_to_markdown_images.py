#!/usr/bin/env python3
"""
Convert PDF pages to base64 encoded images for AI markdown analysis
"""

import sys
import json
import base64
import io
import fitz  # PyMuPDF

def pdf_to_images_for_ai(pdf_data, pages=None, max_pages=50):
    """Convert PDF pages to base64 images optimized for AI analysis (memory efficient)"""
    
    try:
        # Open PDF from memory
        pdf_document = fitz.open(stream=pdf_data, filetype="pdf")
        
        total_pages = len(pdf_document)
        print(f"📄 PDF has {total_pages} pages", file=sys.stderr)
        
        # Safety check to prevent server crashes
        if total_pages > 100:
            print(f"❌ PDF too large ({total_pages} pages). Maximum allowed: 100 pages", file=sys.stderr)
            pdf_document.close()
            return []
        
        # Determine which pages to convert
        if pages:
            page_numbers = pages[:max_pages]  # Limit pages
        else:
            page_numbers = list(range(min(total_pages, max_pages)))
        
        print(f"📝 Converting {len(page_numbers)} pages (max: {max_pages})", file=sys.stderr)
        
        images = []
        
        for page_num in page_numbers:
            if page_num >= total_pages:
                print(f"⚠️ Page {page_num + 1} does not exist, skipping", file=sys.stderr)
                continue
                
            page = pdf_document[page_num]
            
            # Use lower resolution to save memory (1.0x instead of 2.0x)
            mat = fitz.Matrix(1.0, 1.0)  # Normal resolution for memory efficiency
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to JPEG for much smaller file size
            img_data = pix.tobytes("jpeg", jpg_quality=85)  # Good quality, much smaller
            
            # Encode to base64
            img_base64 = base64.b64encode(img_data).decode('utf-8')
            
            images.append({
                "page": page_num + 1,  # 1-indexed for user display
                "format": "jpeg",
                "data": img_base64,
                "width": pix.width,
                "height": pix.height,
                "size_kb": len(img_data) // 1024
            })
            
            print(f"✅ Page {page_num + 1}: {pix.width}x{pix.height} ({len(img_data)//1024}KB JPEG)", file=sys.stderr)
            
            pix = None  # Clean up immediately
        
        pdf_document.close()
        
        print(f"📊 Successfully converted {len(images)} pages to images", file=sys.stderr)
        
        return images
        
    except Exception as e:
        import traceback
        print(f"❌ Error converting PDF to images: {e}", file=sys.stderr)
        print(f"❌ Traceback: {traceback.format_exc()}", file=sys.stderr)
        return []

if __name__ == "__main__":
    # Read PDF from stdin
    pdf_data = sys.stdin.buffer.read()
    
    # Parse arguments
    pages = None
    save_images = False
    output_dir = "output"
    
    for i, arg in enumerate(sys.argv[1:], 1):
        if arg == "--save":
            save_images = True
        elif arg.startswith("--output="):
            output_dir = arg.split("=", 1)[1]
            save_images = True
        elif not pages:  # First non-flag argument is pages
            try:
                if arg.startswith('[') and arg.endswith(']'):
                    # Parse as JSON array
                    pages = json.loads(arg)
                    # Convert to 0-indexed
                    pages = [p - 1 for p in pages if p > 0]
                else:
                    # Single page number
                    page_num = int(arg)
                    if page_num > 0:
                        pages = [page_num - 1]  # Convert to 0-indexed
            except (ValueError, json.JSONDecodeError) as e:
                print(f"⚠️ Invalid pages argument: {e}", file=sys.stderr)
    
    print(f"📊 Received {len(pdf_data)} bytes of PDF data", file=sys.stderr)
    if pages:
        print(f"📝 Converting specific pages: {[p+1 for p in pages]}", file=sys.stderr)
    else:
        print(f"📝 Converting all pages", file=sys.stderr)
    
    # Convert PDF to images
    result = pdf_to_images_for_ai(pdf_data, pages)
    
    # Save images to files if requested
    if save_images and result:
        import os
        os.makedirs(output_dir, exist_ok=True)
        
        for item in result:
            page_num = item['page']
            format_type = item['format']
            image_data = item['data']
            size_kb = item['size_kb']
            
            # Decode base64 to bytes
            image_bytes = base64.b64decode(image_data)
            
            # Save to file
            filename = os.path.join(output_dir, f"page_{page_num:02d}.{format_type}")
            with open(filename, 'wb') as f:
                f.write(image_bytes)
            
            print(f"💾 Saved {filename} ({size_kb}KB)", file=sys.stderr)
    
    # Output results as JSON to stdout
    print(json.dumps(result, separators=(',', ':')))
    