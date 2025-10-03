#!/usr/bin/env python3
"""
Enhanced PDF form filling using PyMuPDF with proper form data update
"""

import sys
import json
import io
import fitz  # PyMuPDF

def fill_pdf_form_with_fitz_v2(pdf_data, field_values):
    """Fill PDF form fields using PyMuPDF with enhanced form handling"""
    
    try:
        # Open PDF from memory
        pdf_document = fitz.open(stream=pdf_data, filetype="pdf")
        
        print(f"📄 PDF has {len(pdf_document)} pages", file=sys.stderr)
        
        filled_count = 0
        
        # Method 1: Use the form field dict approach
        try:
            form_data = {}
            
            # Collect all existing field names first
            all_field_names = set()
            for page_num in range(len(pdf_document)):
                page = pdf_document[page_num]
                widgets = list(page.widgets())
                
                for widget in widgets:
                    if widget.field_name:
                        all_field_names.add(widget.field_name)
                        # Set current values
                        if widget.field_name in field_values:
                            form_data[widget.field_name] = str(field_values[widget.field_name])
            
            print(f"🔍 Found {len(all_field_names)} unique field names", file=sys.stderr)
            print(f"📝 Will update {len(form_data)} fields", file=sys.stderr)
            
            # Use PyMuPDF's form field updating
            if form_data:
                # Update fields page by page
                for page_num in range(len(pdf_document)):
                    page = pdf_document[page_num]
                    widgets = list(page.widgets())
                    
                    page_filled = 0
                    for widget in widgets:
                        if widget.field_name and widget.field_name in field_values:
                            field_value = str(field_values[widget.field_name])
                            
                            try:
                                # Set the field value and update
                                widget.field_value = field_value
                                widget.update()
                                page_filled += 1
                                
                                print(f"✅ Page {page_num + 1}: Set '{widget.field_name}' = '{field_value}'", file=sys.stderr)
                                
                            except Exception as widget_error:
                                print(f"⚠️ Page {page_num + 1}: Could not set '{widget.field_name}': {widget_error}", file=sys.stderr)
                    
                    if page_filled > 0:
                        filled_count += page_filled
        
        except Exception as method1_error:
            print(f"⚠️ Method 1 error: {method1_error}", file=sys.stderr)
        
        print(f"📊 Successfully filled {filled_count} form fields", file=sys.stderr)
        
        # Get PDF as bytes and close
        pdf_bytes = pdf_document.tobytes()
        pdf_document.close()
        return pdf_bytes
        
    except Exception as e:
        import traceback
        print(f"❌ PyMuPDF v2 Error: {e}", file=sys.stderr)
        print(f"❌ PyMuPDF v2 Traceback: {traceback.format_exc()}", file=sys.stderr)
        return None

def verify_filled_pdf(pdf_data):
    """Verify that the PDF has been filled correctly"""
    
    try:
        pdf_document = fitz.open(stream=pdf_data, filetype="pdf")
        
        verification_results = {}
        
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            widgets = list(page.widgets())
            
            for widget in widgets:
                if widget.field_name:
                    field_value = widget.field_value if widget.field_value else ''
                    verification_results[widget.field_name] = {
                        'value': field_value,
                        'type': widget.field_type_string,
                        'page': page_num + 1
                    }
        
        pdf_document.close()
        return verification_results
        
    except Exception as e:
        print(f"❌ Verification error: {e}", file=sys.stderr)
        return {}

if __name__ == "__main__":
    # Read PDF from stdin
    pdf_data = sys.stdin.buffer.read()
    
    # Read field values from command line argument
    if len(sys.argv) > 1:
        field_values = json.loads(sys.argv[1])
    else:
        field_values = {}
    
    print(f"📊 Received {len(pdf_data)} bytes of PDF data", file=sys.stderr)
    print(f"📝 Attempting to fill {len(field_values)} form fields using PyMuPDF v2", file=sys.stderr)
    
    # Fill the PDF
    result = fill_pdf_form_with_fitz_v2(pdf_data, field_values)
    
    # Verify the results
    if result:
        print("🔍 Verifying filled PDF...", file=sys.stderr)
        verification = verify_filled_pdf(result)
        
        for field_name, field_info in verification.items():
            if field_name in field_values:
                expected = str(field_values[field_name])
                actual = field_info['value']
                if actual == expected:
                    print(f"✅ Verified: '{field_name}' = '{actual}'", file=sys.stderr)
                else:
                    print(f"⚠️ Mismatch: '{field_name}' expected '{expected}', got '{actual}'", file=sys.stderr)
    
    # If filling fails, return original PDF
    if result is None:
        print("❌ PyMuPDF v2 filling failed, returning original PDF", file=sys.stderr)
        result = pdf_data
    
    # Output the result
    sys.stdout.buffer.write(result)