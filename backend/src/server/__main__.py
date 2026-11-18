import os
import sys

from app.AppBuilder import AppBuilder, AppException
from dotenv import load_dotenv


def main():
    load_dotenv()

    app = AppBuilder(name=os.getenv("APP_NAME", "MyApp"))   \
        .addPort(int(os.getenv("PORT", "5000")))            \
        .addHost(os.getenv("HOST", "localhost"))            \
        .addRoute("/", lambda: "Hello World!")              \
        .build()

    try:
        app.run()
    except AppException as e:
        print(f"\nApp error: {e}", file=sys.stderr)
    except Exception as e:
        print(f"\n Unexpected error: {e}", file=sys.stderr)
    except KeyboardInterrupt:
        print("\nServer stopped by user.", file=sys.stderr)


if __name__ == "__main__":
    main()
