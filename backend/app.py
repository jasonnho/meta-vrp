from fastapi import FastAPI

app = FastAPI(title="Meta-VRP API", version="0.1")

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "FastAPI backend running"}
