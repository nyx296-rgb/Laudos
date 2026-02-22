import urllib.request
import json
import socket

# Try to find an open port or use the default 5000
BASE_URL = "http://localhost:5000"

def verify_pdf(filename):
    url = f"{BASE_URL}/api/view-pdf/{filename}"
    print(f"Verifying: {url}")
    try:
        with urllib.request.urlopen(url) as response:
            print(f"Status: {response.status}")
            print(f"Content-Type: {response.getheader('Content-Type')}")
            return True
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.reason}")
        return False
    except urllib.error.URLError as e:
        print(f"URL Error: {e.reason}")
        return False

if __name__ == "__main__":
    # Test an imported record mapping
    # IMP-035/2025 -> Laudo_IMP-035_2025.pdf
    verify_pdf("Laudo_IMP-035_2025.pdf")
