import time
print("Importing app.main...")
start = time.time()
try:
    import app.main
    print(f"Imported app.main in {time.time() - start:.2f}s")
except Exception as e:
    print(f"Failed to import app.main: {e}")
