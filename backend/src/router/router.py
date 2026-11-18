from typing import Literal, Tuple, Iterator, Dict, Callable, Any
import inspect


type METHOD_NAME = Literal["GET", "POST", "PUT", "DELETE", "PATCH"]


routes: Dict[str, Tuple[str, METHOD_NAME]] = {}


def route(path: str, type: METHOD_NAME = "GET") -> Callable[[Callable[[], str]], Callable[[], str]]:
    def wrapper(func: Callable[[], str]) -> Callable[[], str]:
        routes[func.__name__] = (path, type)
        return func
    return wrapper


class RouterException(Exception):
    pass


class Router:

    @staticmethod
    @route("auth/code", "POST")
    def auth_code() -> str:
        return "Hello from Router!"


    @classmethod
    def __iter__(cls) -> Iterator[Tuple[str, Any, str]]:
        for name, member in inspect.getmembers(cls):
            if not isinstance(inspect.getattr_static(cls, name), staticmethod) and not name.startswith("__"):
                continue
            path, method_type = routes.get(name, (None, "GET"))
            if path is None:
                raise RouterException(f"Route for method '{name}' is not defined.")
            yield path, member, method_type
