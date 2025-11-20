#!/bin/bash
# Test script to simulate different domain access

echo "Testing with different Host headers..."
echo ""

echo "1. Testing with localhost (should work):"
curl -s -o /dev/null -w "Status: %{http_code}\n" -H "Host: localhost" http://localhost:8080/
echo ""

echo "2. Testing with example.com (should be blocked without --host 0.0.0.0):"
curl -s -H "Host: example.com" http://localhost:8080/ | head -3
echo ""

echo "3. Testing with myapp.local (should be blocked without --host 0.0.0.0):"
curl -s -H "Host: myapp.local" http://localhost:8080/ | head -3
echo ""

echo "To test with a real domain, add to /etc/hosts:"
echo "  127.0.0.1  myapp.local"
echo "Then visit: http://myapp.local:8080"
