#!/usr/bin/env python3
"""
Discover all form fields in a PDF using PyMuPDF
Returns JSON with field names, types, and current values
"""

import sys
import json
import io
import argparse
import fitz  # PyMuPDF


def sort_fields_reading_order(fields):
    """Sort fields in natural reading order: top to bottom, left to right"""
    # Define tolerance for considering fields on the same row (in points)
    ROW_TOLERANCE = 10

    def get_sort_key(field):
        # Primary sort: Y coordinate (top to bottom) - bigger Y = lower on page = higher priority
        # Secondary sort: X coordinate (left to right) - smaller X = left = higher priority
        y = field["y"]
        x = field["x"]

        # Round Y to nearest ROW_TOLERANCE to group fields on same row
        row = round(y / ROW_TOLERANCE) * ROW_TOLERANCE

        # Return tuple for sorting: (X ascending first, then Y descending)
        # Primary sort: smaller X has higher priority (left to right)
        # Secondary sort: bigger Y has higher priority (top to bottom in converted coords)
        return (row * -y, x)

    return sorted(fields, key=get_sort_key)


def discover_all_pdf_fields(pdf_data, target_page=None):
    """Discover all form fields in a PDF with widget-like structure"""

    try:
        pdf_document = fitz.open(stream=pdf_data, filetype="pdf")

        all_fields = []

        for page_num in range(len(pdf_document)):
            # Skip if target_page is specified and this isn't the target page
            if target_page is not None and page_num + 1 != target_page:
                continue

            page = pdf_document[page_num]
            widgets = list(page.widgets())
            page_fields = []

            for widget in widgets:
                field_name = widget.field_name
                field_type = widget.field_type_string
                field_value = widget.field_value if widget.field_value else ""

                if field_name:
                    # Get widget rectangle
                    rect = widget.rect

                    # Convert PyMuPDF coordinates to match frontend expectations
                    # PyMuPDF uses bottom-left origin, convert to top-left
                    page_height = page.rect.height
                    converted_y = (
                        page_height - rect.y1
                    )  # Use y1 for top-left conversion

                    # Convert field type to PDF annotation type format
                    pdf_type = "/Tx"  # Default to text
                    if field_type == "CheckBox":
                        pdf_type = "/Btn"
                    elif field_type == "Signature":
                        pdf_type = "/Sig"

                    # Get checkbox choices for button widgets
                    choices = []
                    if field_type == "CheckBox":
                        try:
                            # Try to get button states (appearance dictionary)
                            if hasattr(widget, "button_states"):
                                choices = widget.button_states()

                            # Alternative method: access the annotation directly
                            if not choices and hasattr(widget, "_annot"):
                                annot = widget._annot
                                if annot:
                                    ap_dict = annot.get("/AP")
                                    if ap_dict and "/N" in ap_dict:
                                        normal_ap = ap_dict["/N"]
                                        if hasattr(normal_ap, "keys"):
                                            choices = list(normal_ap.keys())
                                        elif isinstance(normal_ap, dict):
                                            choices = list(normal_ap.keys())

                            # Fallback: try to get from widget directly
                            if not choices:
                                try:
                                    # Access the widget's annotation object
                                    widget_obj = widget._get_widget()
                                    if widget_obj and "/AP" in widget_obj:
                                        ap = widget_obj["/AP"]
                                        if "/N" in ap:
                                            choices = list(ap["/N"].keys())
                                except:
                                    pass

                        except Exception as e:
                            # If all methods fail, we'll detect from current value
                            if field_value and field_value != "Off":
                                choices = ["Off", field_value]
                            else:
                                choices = ["Off"]

                    # Flatten and deduplicate choices if it's a dict
                    if isinstance(choices, dict):
                        all_choices = []
                        for key, value_list in choices.items():
                            if isinstance(value_list, list):
                                all_choices.extend(value_list)
                        choices = list(set(all_choices)) if all_choices else []

                    # For checkboxes, ensure "Off" is always at index 0
                    if field_type == "CheckBox" and choices:
                        # Sort so "Off" comes first, then other values
                        choices = sorted(
                            choices, key=lambda x: (str(x) != "Off", str(x))
                        )

                    field_data = {
                        "page": page_num + 1,
                        "name": field_name,
                        "type": pdf_type,
                        "field_type": field_type,
                        "current_value": field_value,
                        "choices": choices,
                        "rect": [
                            rect.x0,
                            converted_y,
                            rect.x1,
                            converted_y + (rect.y1 - rect.y0),
                        ],
                        "x": rect.x0,
                        "y": converted_y,
                        "width": rect.x1 - rect.x0,
                        "height": rect.y1 - rect.y0,
                        "field_flags": widget.field_flags
                        if hasattr(widget, "field_flags")
                        else 0,
                        "label": "",
                        "potential_labels": [],
                    }

                    page_fields.append(field_data)

            # Sort fields on this page in reading order
            sorted_page_fields = sort_fields_reading_order(page_fields)
            all_fields.extend(sorted_page_fields)

        pdf_document.close()

        # Assign IDs based on final sorted order (reading order)
        for i, field in enumerate(all_fields, 1):
            field["id"] = i

        return all_fields

    except Exception as e:
        print(f"Error discovering fields: {e}", file=sys.stderr)
        return []


if __name__ == "__main__":
    # Read PDF from stdin
    pdf_data = sys.stdin.buffer.read()

    # Discover all fields
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Discover PDF form fields")
    parser.add_argument(
        "--page",
        type=int,
        help="Extract fields from specific page only (default: all pages)",
    )
    args = parser.parse_args()

    fields = discover_all_pdf_fields(pdf_data, target_page=args.page)

    # Output as JSON
    print(json.dumps(fields, separators=(",", ":")))
