"""The game behind the API routes: sessions, draws, turns, collection, summary.

store.py keeps a game in the team's database (db.protocol.Database) and turns
it into the AI's models;
service.py is what each route does, returning the shapes the front expects
(frontend/src/types.ts).
"""
