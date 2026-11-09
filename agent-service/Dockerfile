FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir . && useradd -r -u 10001 agent
USER agent
EXPOSE 4010
HEALTHCHECK CMD python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:4010/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4010"]
