FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    OUTPUT_DIR=/data \
    AUTH_DB_PATH=/data/auth.sqlite3 \
    WORKSPACE_ROOT=/data/workspaces
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py ./
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8000
# --proxy-headers trusts X-Forwarded-* from the Cloudflare proxy / reverse proxy in front.
CMD ["uvicorn","server:app","--host","0.0.0.0","--port","8000","--proxy-headers","--forwarded-allow-ips","*"]
