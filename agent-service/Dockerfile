FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY pyproject.toml ./
COPY app ./app
COPY knowledge ./knowledge
# Installation « editable » : le code reste dans /srv, donc app/prompts/*.md et knowledge/ sont trouves a l'execution
# (un `pip install .` classique ne copierait pas les fichiers .md).
RUN pip install --no-cache-dir -e .

# Voix Piper (optionnelle, ~60 Mo de modele + onnxruntime). Desactivee par defaut : sur une offre gratuite de 512 Mo de RAM,
# elle peut faire tomber le service. Activer avec --build-arg WITH_VOICE=true et TTS_PROVIDER=piper.
ARG WITH_VOICE=false
RUN if [ "$WITH_VOICE" = "true" ]; then \
      pip install --no-cache-dir piper-tts && \
      mkdir -p voices && python -m piper.download_voices --download-dir voices fr_FR-siwis-medium; \
    fi

RUN useradd -r -u 10001 agent && chown -R agent /srv
USER agent
ENV PORT=4010
EXPOSE 4010
HEALTHCHECK CMD python -c "import os, urllib.request as u; u.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT', '4010'))"
# Render fournit PORT ; en local, 4010 par defaut.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-4010}"]
