#!/bin/bash
cd "$(dirname "$0")/app"
exec ../.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8077
