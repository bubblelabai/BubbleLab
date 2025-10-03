#!/usr/bin/env python3
"""
Simple PDF verification using PyMuPDF
"""

import sys
import fitz


def verify_pdf_fields(pdf_path):
    """Verify field values in a PDF using PyMuPDF"""

    try:
        pdf_document = fitz.open(pdf_path)

        print(f"📄 PDF has {len(pdf_document)} pages")

        found_fields = {}

        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            widgets = list(page.widgets())

            for widget in widgets:
                if widget.field_name and widget.field_value:
                    found_fields[widget.field_name] = {
                        "value": widget.field_value,
                        "type": widget.field_type_string,
                        "page": page_num + 1,
                    }
                    print(
                        f"✅ Field '{widget.field_name}' = '{widget.field_value}' on page {page_num + 1}"
                    )

        pdf_document.close()

        if not found_fields:
            print("❌ No filled fields found")
        else:
            print(f"📊 Found {len(found_fields)} filled fields")

        return found_fields

    except Exception as e:
        print(f"❌ Error: {e}")
        return {}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_pdf.py <pdf_path>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    verify_pdf_fields(pdf_path)
