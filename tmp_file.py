from pathlib import Path 
path = Path('explorium.docs') 
print(path.suffix) 
print(path.name) 
print(path.read_bytes()[:16]) 
print(path.stat().st_size) 
