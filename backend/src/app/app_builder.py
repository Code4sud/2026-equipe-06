from flask import Flask
from flask_cors import CORS
from typing import Self, Callable, List, Literal, TypeVar
import atexit

from db import protocol

type METHOD_NAME = Literal["GET", "POST", "PUT", "DELETE", "PATCH"]


T = TypeVar("T", bound=protocol.Database)


class AppException(Exception):
    pass


class App:
    def __init__(self: Self, name: str):
        self.__flask: Flask = Flask(name)
        self.__host: str | None = None
        self.__port: int | None = None
        self.__db: protocol.Database | None = None

    def run(self: Self):
        if self.__host is None or self.__port is None:
            raise AppException(
                "Host and port must be set before running the app."
            )
        self.__flask.run(host=self.__host, port=self.__port)

    @property
    def port(self: Self) -> int:
        if self.__port is None:
            raise AppException("Port is not set.")
        return self.__port

    @port.setter
    def port(self: Self, port: int):
        self.__port = port

    @property
    def host(self: Self) -> str:
        if self.__host is None:
            raise AppException("Host is not set.")
        return self.__host

    @host.setter
    def host(self: Self, host: str):
        self.__host = host

    @property
    def flask(self: Self) -> Flask:
        return self.__flask

    @property
    def db(self: Self) -> protocol.Database:
        if self.__db is None:
            raise AppException("Database is not set.")
        return self.__db

    @db.setter
    def db(self: Self, db: protocol.Database):
        self.__db = db


class AppBuilder:
    def __init__(self: Self, name: str):
        self.__app = App(name)

    def addRoute(
        self: Self,
        path: str,
        callback: Callable[[], str],
        methods: List[METHOD_NAME] = ["GET"],
    ) -> Self:
        self.__app.flask.add_url_rule(
            path, view_func=callback, methods=methods
        )

        return self

    def addCORS(self: Self, origins: List[str] | str = "*") -> Self:
        CORS(self.__app.flask, origins=origins)

        return self

    def addPort(self: Self, port: str) -> Self:
        try:
            self.__app.port = int(port)
        except ValueError:
            raise AppException(
                f"Invalid port value: {port}. Port must be an integer."
            )
        return self

    def addHost(self: Self, host: str) -> Self:
        self.__app.host = host
        return self

    def addDatabase(
        self: Self, db_uri: str, db_name: str, db: Callable[[str, str], T]
    ) -> Self:
        self.__app.db = db(db_uri, db_name)
        self.__app.db.connect()
        atexit.register(self.__app.db.close)
        self.__app.flask.extensions["db"] = self.__app.db

        return self

    def build(self: Self) -> App:
        return self.__app
