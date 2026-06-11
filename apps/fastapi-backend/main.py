from fastapi import FastAPI
from routers import knowledge_projects

app = FastAPI(
    title="Ocean FastAPI Backend",
    description="Python rewrite of Ocean API",
    version="1.0.0"
)

app.include_router(knowledge_projects.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Ocean FastAPI Backend!"}


from fastapi import FastAPI

app = FastAPI(
    title="Ocean FastAPI Backend",
    description="Python rewrite of Ocean API",
    version="1.0.0"
)

app.include_router(knowledge_projects.router)

def read_root():
    return {"message": "Welcome to Ocean FastAPI Backend!"}
