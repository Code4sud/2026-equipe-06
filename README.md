# Équipe 06 — Hackathon Azuréen #3

Projet réalisé à Nice les 18, 19 et 20 novembre 2026, sur le thème **« L'orientation et l'employabilité grâce à l'IA »**, organisé par [Code4Sud](https://code4sud.fr).

## Le projet

**Pioche ta voix** répond au sujet « Détecteur du potentiel caché » du Centre des Possibles. Beaucoup de jeunes de 15 à 25 ans pensent « ne rien savoir faire », alors qu'ils ont vécu des expériences porteuses de compétences. Dans ce jeu de cartes conversationnel, le jeune pioche une carte à thème et raconte son histoire à voix haute. Une IA l'écoute sans le juger, l'aide à mettre des mots sur ce qu'il sait faire et en tire des cartes compétences reliées au référentiel ROME 4.0. À la fin, le jeune repart avec un bilan qu'il peut garder en PDF et partager avec un conseiller ou un psychologue.

## Lancer le projet

Il faut Python 3.12 avec [uv](https://docs.astral.sh/uv/), Node.js et une clé API Mistral.

```bash
echo "MISTRAL_API_KEY=ta_cle" > backend/.env.local
cd backend && PYTHONPATH=src uv run python -m ai.dev_server     # API sur le port 5000, base en mémoire, sans code e-mail
echo "VITE_USE_MOCK=false" > frontend/.env.local
cd frontend && npm install && npm run dev                       # http://localhost:5173
```

Toutes les variables possibles sont décrites dans `backend/.env.example` et `frontend/.env.example`.

## Mettre en production

```bash
cp backend/.env.example backend/.env                # remplir MongoDB, Mistral, Brevo et FRONTEND_URL (adresse du front)
cd backend && make up                               # Docker + gunicorn, API sur le port 4242
cp frontend/.env.example frontend/.env.production   # VITE_API_URL = adresse du back, sans /api
cd frontend && npm ci && npm run build              # site statique dans frontend/dist/, à servir tel quel
```

Les variables du front sont lues au moment du build : après tout changement, il faut relancer `npm run build`. Ne jamais mettre `AUTH_SKIP_CODE` en production, car cette variable supprime le code de connexion.

## Technique

- **Front** (`frontend/`) : React 19, TypeScript et Vite ; PDF du bilan avec `@react-pdf/renderer`.
- **Back** (`backend/`) : Python, Flask et MongoDB, déployé avec Docker et gunicorn.
- **IA** (`backend/src/ai/`) : API Mistral. `mistral-medium` mène la conversation, analyse les tours et rédige le bilan ; Voxtral transcrit la voix (STT) et fait parler l'IA (TTS).
- **Données** (`backend/data/`) : cartes à thème et compétences du référentiel ROME 4.0.

## Démo en ligne

https://two026-equipe-06-1-front.onrender.com (hébergée sur l'offre gratuite de Render : le premier chargement peut prendre une minute, le temps que le serveur se réveille).

## Licence

MIT — voir `LICENSE`.
