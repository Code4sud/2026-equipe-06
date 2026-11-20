import os
import sys

from app.app_builder import AppBuilder, AppException, App
from router.router import Router, RouterException
from db.mongo import MongoDatabase
from ai.data import use_card_source
from game.cards import card_source, sync_cards
from dotenv import load_dotenv


class ServerEnvironment:
    __is_loaded: bool = False

    class EnvironmentError(Exception):
        pass

    @classmethod
    def load(cls, dotenv_path: str = ".env"):
        if not cls.__is_loaded:
            load_dotenv(dotenv_path)
            cls.__is_loaded = True

    @classmethod
    def get(cls, key: str, default: str | None = None) -> str:
        if not cls.__is_loaded:
            raise cls.EnvironmentError(
                "Environment variables are not loaded. Call 'load' method "
                "first."
            )

        value = os.getenv(key, default)
        if value is None:
            raise cls.EnvironmentError(
                f"Environment variable '{key}' is not set."
            )

        return value


def build_app() -> App:
    ServerEnvironment.load()

    app_builder = (
        AppBuilder(name=ServerEnvironment.get("APP_NAME"))
        .addPort(ServerEnvironment.get("PORT"))
        .addHost(ServerEnvironment.get("HOST"))
        .addCORS(origins=ServerEnvironment.get("FRONTEND_URL", "*"))
        .addDatabase(
            ServerEnvironment.get("DB_URI"),
            ServerEnvironment.get("DB_NAME"),
            MongoDatabase,
        )
        .addRoute("/", lambda: "Hello World!")
    )

    for route_name, route_func, route_type in Router():
        app_builder.addRoute(f"/api/{route_name}", route_func, [route_type])

    app = app_builder.build()
    # The deck lives in the database: copied from data/cards.json when needed
    sync_cards(app.db)
    use_card_source(card_source(app.db))
    return app


def main():
    ServerEnvironment.load()

    try:
        build_app().run()

    except AppException as e:
        print(f"\nApp error: {e}", file=sys.stderr)
    except ServerEnvironment.EnvironmentError as e:
        print(f"\nEnvironment error: {e}", file=sys.stderr)
    except RouterException as e:
        print(f"\nRouter error: {e}", file=sys.stderr)
    except Exception as e:
        print(f"\n Unexpected error: {e}", file=sys.stderr)
    except KeyboardInterrupt:
        print("\nServer stopped by user.", file=sys.stderr)


if __name__ == "__main__":
    main()
