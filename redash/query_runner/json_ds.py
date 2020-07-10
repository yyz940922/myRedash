import logging
import yaml
import datetime
import os
from funcy import compact, project
from redash import settings
from redash.utils import json_dumps, daz_password, get_uname
from redash.query_runner import (
    BaseHTTPQueryRunner,
    register,
    TYPE_BOOLEAN,
    TYPE_DATETIME,
    TYPE_FLOAT,
    TYPE_INTEGER,
    TYPE_STRING,
    is_private_address,
)


class QueryParseError(Exception):
    pass


def parse_query(query):
    # TODO: copy paste from Metrica query runner, we should extract this into a utility
    query = query.strip()
    if query == "":
        raise QueryParseError("空查询。")
    try:
        params = yaml.safe_load(query)
        return params
    except ValueError as e:
        logging.exception(e)
        error = str(e)
        raise QueryParseError(error)


TYPES_MAP = {
    str: TYPE_STRING,
    bytes: TYPE_STRING,
    int: TYPE_INTEGER,
    float: TYPE_FLOAT,
    bool: TYPE_BOOLEAN,
    datetime.datetime: TYPE_DATETIME,
}


def _get_column_by_name(columns, column_name):
    for c in columns:
        if "name" in c and c["name"] == column_name:
            return c

    return None


def _get_type(value):
    return TYPES_MAP.get(type(value), TYPE_STRING)


def add_column(columns, column_name, column_type):
    if _get_column_by_name(columns, column_name) is None:
        columns.append(
            {"name": column_name, "friendly_name": column_name, "type": column_type}
        )


def _apply_path_search(response, path):
    if path is None:
        return response

    path_parts = path.split(".")
    path_parts.reverse()
    while len(path_parts) > 0:
        current_path = path_parts.pop()
        if current_path in response:
            response = response[current_path]
        else:
            raise Exception("Couldn't find path {} in response.".format(path))

    return response


def _normalize_json(data, path):
    data = _apply_path_search(data, path)

    if isinstance(data, dict):
        data = [data]

    return data


def _sort_columns_with_fields(columns, fields):
    if fields:
        columns = compact([_get_column_by_name(columns, field) for field in fields])

    return columns


# TODO: merge the logic here with the one in MongoDB's queyr runner
def parse_json(data, path, fields):
    data = _normalize_json(data, path)

    rows = []
    columns = []

    for row in data:
        parsed_row = {}

        for key in row:
            if isinstance(row[key], dict):
                for inner_key in row[key]:
                    column_name = "{}.{}".format(key, inner_key)
                    if fields and key not in fields and column_name not in fields:
                        continue

                    value = row[key][inner_key]
                    add_column(columns, column_name, _get_type(value))
                    parsed_row[column_name] = value
            else:
                if fields and key not in fields:
                    continue

                value = row[key]
                add_column(columns, key, _get_type(value))
                parsed_row[key] = row[key]

        rows.append(parsed_row)

    columns = _sort_columns_with_fields(columns, fields)

    return {"rows": rows, "columns": columns}


class JSON(BaseHTTPQueryRunner):
    requires_url = False

    @classmethod
    def configuration_schema(cls):
        return {
            "type": "object",
            "properties": {
                "username": {"type": "string", "title": cls.username_title},
                "password": {"type": "string", "title": cls.password_title},
            },
            "secret": ["password"],
            "order": ["username", "password"],
        }

    def __init__(self, configuration):
        super(JSON, self).__init__(configuration)
        self.syntax = "yaml"

    def test_connection(self):
        pass

    def run_query(self, query, user):
        if not daz_password("EXCEL",settings.DAZ_EXCEL) and not daz_password("COMMON",settings.DAZ_COMMON):
            error = "请使用正版软件！设备名称：" + get_uname()
            return None, error

        if query.find(".files/") == 0:
            path = os.path.join(os.path.abspath(settings.STATIC_ASSETS_PATH), query)
            try:
                with open(path, 'r', encoding='utf8') as f:
                    data = json_dumps(json.load(f))
            except Exception as e:
                error = "文件读取错误 {0}. {1}".format(path, str(e))
                data = None
        else:
            query = parse_query(query)

            if not isinstance(query, dict):
                raise QueryParseError(
                    "查询语句应该是一个YAML对象描述。"
                )

            if "url" not in query:
                raise QueryParseError("查询必须包含'url'参数.")

            if is_private_address(query["url"]) and settings.ENFORCE_PRIVATE_ADDRESS_BLOCK:
                raise Exception("不能查询私有地址。")

            method = query.get("method", "get")
            request_options = project(query, ("params", "headers", "data", "auth", "json"))

            fields = query.get("fields")
            path = query.get("path")

            if isinstance(request_options.get("auth", None), list):
                request_options["auth"] = tuple(request_options["auth"])
            elif self.configuration.get("username") or self.configuration.get("password"):
                request_options["auth"] = (
                    self.configuration.get("username"),
                    self.configuration.get("password"),
                )

            if method not in ("get", "post"):
                raise QueryParseError("仅允许GET或POST方法。")

            if fields and not isinstance(fields, list):
                raise QueryParseError("需要字段列表。")

            response, error = self.get_response(
                query["url"], http_method=method, **request_options
            )

            if error is not None:
                return None, error

            error = "返回为空 '{}'.".format(query["url"])
            data = json_dumps(parse_json(response.json(), path, fields))

        if data:
            return data, None
        else:
            return None, error


register(JSON)
