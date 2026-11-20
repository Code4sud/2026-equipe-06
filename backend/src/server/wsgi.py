"""Point d'entrée pour gunicorn : gunicorn 'server.wsgi:application'"""

from server.__main__ import build_app

application = build_app().flask
