from bson import ObjectId
from bson.errors import InvalidId
from pymongo import MongoClient
from .protocol import Document


class MongoDatabase:
    class MongoError(Exception):
        pass

    def __init__(self, uri: str, db_name: str):
        self.__uri = uri
        self.__db_name = db_name
        self.__client: MongoClient | None = None

    def connect(self) -> None:
        self.__client = MongoClient(self.__uri, serverSelectionTimeoutMS=5000)
        self.__client.admin.command("ping")

    def close(self) -> None:
        if self.__client:
            self.__client.close()

    @property
    def __db(self):
        if self.__client is None:
            raise MongoDatabase.MongoError("Database not connected")
        return self.__client[self.__db_name]

    @staticmethod
    def __oid(id: str) -> ObjectId | None:
        try:
            return ObjectId(id)
        except (InvalidId, TypeError):
            return None

    @staticmethod
    def __out(doc: Document | None) -> Document | None:
        if doc is None:
            return None
        doc["id"] = str(doc.pop("_id"))
        return doc

    def get(self, collection, id):
        oid = self.__oid(id)
        if not oid:
            return None
        return (
            self.__out(self.__db[collection].find_one({"_id": oid}))
            if oid
            else None
        )

    def find(self, collection, filters=None, limit=100, skip=0):
        cursor = (
            self.__db[collection].find(filters or {}).skip(skip).limit(limit)
        )
        return [self.__out(d) for d in cursor]

    def insert(self, collection, data):
        return str(self.__db[collection].insert_one(data).inserted_id)

    def update(self, collection, id, data):
        oid = self.__oid(id)
        if not oid:
            return False
        return (
            self.__db[collection]
            .update_one({"_id": oid}, {"$set": data})
            .matched_count
            == 1
        )

    def delete(self, collection, id):
        oid = self.__oid(id)
        if not oid:
            return False
        return (
            self.__db[collection].delete_one({"_id": oid}).deleted_count == 1
        )
