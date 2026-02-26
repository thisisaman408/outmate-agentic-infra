
import http.client
import json

def check_backend():
    print("Checking backend on 127.0.0.1:8000...")
    try:
        conn = http.client.HTTPConnection("127.0.0.1", 8000, timeout=5)
        conn.request("GET", "/api/visitors/stats")
        res = conn.getresponse()
        print(f"Status: {res.status}")
        print(f"Reason: {res.reason}")
        data = res.read().decode()
        print(f"Data: {data}")
        conn.close()
    except Exception as e:
        print(f"Error connecting to 127.0.0.1: {e}")

    print("\nChecking backend on localhost:8000...")
    try:
        conn = http.client.HTTPConnection("localhost", 8000, timeout=5)
        conn.request("GET", "/api/visitors/stats")
        res = conn.getresponse()
        print(f"Status: {res.status}")
        print(f"Reason: {res.reason}")
        data = res.read().decode()
        print(f"Data: {data}")
        conn.close()
    except Exception as e:
        print(f"Error connecting to localhost: {e}")

if __name__ == "__main__":
    check_backend()
