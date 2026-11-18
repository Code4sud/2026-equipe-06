import os


from app.AppBuilder import AppBuilder, AppException
from dotenv import load_dotenv


def main():
    load_dotenv()

    app = AppBuilder(name=os.getenv("APP_NAME", "MyApp"))   \
        .addPort(int(os.getenv("PORT", "5000")))            \
        .addRoute("/", lambda: "Hello World!")              \
        .build()

    try:
        app.run()
    except AppException as e:
        print(f"\nApp error: {e}")
    except Exception as e:
        print(f"\n Unexpected error: {e}")
    except KeyboardInterrupt:
        print("\nServer stopped by user.")


if __name__ == "__main__":
    main()
