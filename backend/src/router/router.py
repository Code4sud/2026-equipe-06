from typing import Literal, Tuple, Iterator, Dict, Callable
import inspect


routes: Dict[str, str] = {}


type METHOD_NAME = Literal["GET", "POST", "PUT", "DELETE", "PATCH"]


def route(type: METHOD_NAME = "GET") -> Callable[[Callable[[], str]], Callable[[], str]]:
    def wrapper(func: Callable[[], str]) -> Callable[[], str]:
        routes[func.__name__] = type
        return func
    return wrapper


class Router:

    @staticmethod
    @route("POST")
    def auth_code() -> str:
        return "Hello from Router!"


    @classmethod
    def __iter__(cls) -> Iterator[Tuple[str, staticmethod, str]]:
        for name, member in inspect.getmembers(cls):
            if isinstance(inspect.getattr_static(cls, name), staticmethod) and not name.startswith("__"):
                yield name, member, routes.get(name, "GET")
