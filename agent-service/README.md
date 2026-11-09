# SmartCampus — agent-service

Assistant IA (Claude + Pydantic AI + FastAPI) pour SmartCampus. Il **n'a aucun droit propre** : il agit avec le JWT
de l'utilisateur connecte, emis par le user-service.

## Lancer
```bash
python -m venv .venv && .venv/Scripts/activate      # Linux/Mac : source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env     # renseigner ANTHROPIC_API_KEY (+ JWT_SECRET en dev si le user-service est en HS256)
uvicorn app.main:app --port 4010 --reload
pytest -q && ruff check .
```

## API
`POST /agent/chat` — `Authorization: Bearer <JWT>` — `{"message": "..."}` →
```json
{"answer": "...", "confidence": "high", "role": "student",
 "actions": [{"tool": "get_my_profile", "args": {"user_id": "ETU-2026-0001"}, "status": "done"}]}
```
`GET /health`. Docs interactives : `/docs`.

## Securite (voir tests/)
- JWT : algorithme fixe cote serveur (RS256 via JWKS en production, HS256 en dev seulement, refuse en production),
  `iss`, `aud`, `exp` obligatoires ; message d'erreur generique.
- Le **role vient du jeton**, jamais du texte. Un outil est **cache** au modele si la permission manque.
- Les appels aux services portent le JWT de l'utilisateur : le user-service reste l'autorite (defense en profondeur).
- Chaque outil appele est journalise dans `actions` (audit). Les erreurs techniques ne sont jamais renvoyees au client.

## Fonctions
| Fonction | Comment l'utiliser |
|---|---|
| Memoire | renvoyer `conversation_id` au tour suivant |
| RAG par role | deposer des `.md` dans `knowledge/` (front-matter `title`, `audience: student, teacher, admin`) ; sans `audience` = admin seulement |
| Ecriture avec confirmation | l'agent PROPOSE (`status: needs_confirmation` + `confirmation_id`) ; l'interface appelle `POST /agent/actions/{id}/confirm` ou `/cancel` |
| Vision | `image_b64` + `image_media_type` (jpeg, png, webp ; 5 Mo ; contenu verifie) |
| Voix | `want_audio: true` -> `audio_b64` (WAV). Necessite `pip install coqui-tts` et `TTS_PROVIDER=coqui` |
| Exports | `output_format`: `json` (defaut), `markdown` (champ `markdown`), `pdf` (champ `pdf_b64`) |

## Gratuit : voix, micro, interface
- **Interface de demo** : `http://localhost:4010/ui` (dev seulement, 404 en production). Micro = dictee du navigateur
  (Chrome/Edge), lecture = voix du navigateur : aucune installation, aucun cout.
- **Voix serveur Piper** (MIT, CPU, ~2 s pour 5 s de parole) :
  `pip install piper-tts` puis `python -m piper.download_voices --download-dir voices fr_FR-siwis-medium`
  puis `TTS_PROVIDER=piper` dans `.env`. Teste ici : WAV francais reel genere.

## Changer de modele (AGENT_MODEL)
Le modele se regle dans `.env`, le code ne change pas. Exemples : `anthropic:claude-sonnet-5-5` (defaut),
`xai:<modele>` (`pip install "pydantic-ai-slim[xai]"`, cle `XAI_API_KEY`), `google-gla:<modele>` (extra `google`).
Apres un changement de modele, relancer `python -m evals.run_evals`.

## Cle Claude
Copier `.env.example` en `.env` et renseigner `ANTHROPIC_API_KEY=...`. Le `.env` est ignore par git : ne jamais commiter la cle.

## Limites connues
- Le RAG est lexical (BM25), pas semantique ; les documents de `knowledge/` sont des EXEMPLES a remplacer.
- Actions en attente et limiteur de debit en RAM : une seule instance (sinon Redis/MongoDB).
- Non verifies sur de vrais systemes : vision Claude, voix Coqui, memoire MongoDB (tests avec doublures).

## Feuille de route
1. [fait] Squelette securise, outils de lecture, 3 roles
2. [fait] Tests d'injection + evaluation sur le vrai modele (`python -m evals.run_evals`)
3. [fait] Memoire, RAG par role, ecriture avec confirmation, vision, voix, exports
4. [a faire] Outils des autres microservices (via leur OpenAPI/MCP), liaison Gateway + front + docker-compose
5. [a faire] Embeddings + Qdrant, deploiement
