import os
import uvicorn

def main():
    port = int(os.environ.get("PORT", "8795"))
    if not 1 <= port <= 65535:
        raise ValueError("INVALID_PORT")
    uvicorn.run("zuma_aws.service:app", host=os.environ.get("HOST", "0.0.0.0"), port=port)

if __name__ == "__main__":
    main()
