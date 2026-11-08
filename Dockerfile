# Production image for Team Tasks (used by Railway, also works on Render / Fly.io).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    SECURE_COOKIES=1 \
    TEAM_TASKS_DB=/data/team_tasks.db

WORKDIR /app
COPY server.py reset_password.py ./
COPY static ./static

# /data must be a persistent volume, or the database is lost on every redeploy.
RUN mkdir -p /data
EXPOSE 8000

CMD ["python", "server.py"]
