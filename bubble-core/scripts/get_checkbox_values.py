#!/usr/bin/env python3
"""
Get all possible checkbox values for a PDF form
Shows both OFF and ON export values for each checkbox
"""

import sys
import json
import io
import fitz  # PyMuPDF

def get_checkbox_export_values(pdf_data):
    """Get all checkbox export values"""
    
    try:
        pdf_document = fitz.open(stream=pdf_data, filetype="pdf")
        
        checkbox_values = {}
        
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            widgets = list(page.widgets())
            
            for widget in widgets:
                field_name = widget.field_name
                field_type = widget.field_type_string
                
                if field_name and field_type == "CheckBox":
                    # Get the widget's button states
                    try:
                        # Get appearance states - these are the export values
                        appearance_states = []
                        if hasattr(widget, 'button_states'):
                            appearance_states = widget.button_states()
                        
                        # Alternative method to get export values
                        annot = widget._annot
                        if annot:
                            ap_dict = annot.get("/AP")
                            if ap_dict and "/N" in ap_dict:
                                normal_ap = ap_dict["/N"]
                                if hasattr(normal_ap, 'keys'):
                                    appearance_states = list(normal_ap.keys())
                        
                        # Current value
                        current_value = widget.field_value if widget.field_value else "Off"
                        
                        checkbox_values[field_name] = {
                            "page": page_num + 1,
                            "current_value": current_value,
                            "possible_values": appearance_states if appearance_states else ["Off", "Unknown"],
                            "field_flags": widget.field_flags if hasattr(widget, 'field_flags') else 0
                        }
                        
                    except Exception as e:
                        # Fallback - just show current value
                        checkbox_values[field_name] = {
                            "page": page_num + 1,
                            "current_value": widget.field_value if widget.field_value else "Off",
                            "possible_values": ["Off", "Unknown"],
                            "field_flags": widget.field_flags if hasattr(widget, 'field_flags') else 0
                        }
        
        pdf_document.close()
        return checkbox_values
        
    except Exception as e:
        print(f"Error getting checkbox values: {e}", file=sys.stderr)
        return {}

if __name__ == "__main__":
    # Read PDF from stdin
    pdf_data = sys.stdin.buffer.read()
    
    # Get checkbox values
    values = get_checkbox_export_values(pdf_data)
    
    # Output as JSON
    print(json.dumps(values, separators=(',', ':')))