import json
import logging
import yaml
import os

from redash import settings
from redash.query_runner import *
from redash.utils import JSONEncoder, daz_password, get_uname

logger = logging.getLogger(__name__)

try:
    import pandas as pd
    import numpy as np
    enabled = True
except ImportError:
    enabled = False


class CSV(BaseQueryRunner):
    should_annotate_query = False

    @classmethod
    def type(cls):
        return "csv"

    @classmethod
    def enabled(cls):
        return enabled

    @classmethod
    def configuration_schema(cls):
        return {
            'type': 'object',
            'properties': {},
        }

    def __init__(self, configuration):
        super(CSV, self).__init__(configuration)
        self.syntax = "csv"

    def test_connection(self):
        pass

    def run_query(self, query, user):
        if not daz_password("EXCEL",settings.DAZ_EXCEL) and not daz_password("COMMON",settings.DAZ_COMMON):
            error = "请使用正版软件！设备名称：" + get_uname()
            return None, error

        path = ""
        args = {}
        try:
            args = yaml.safe_load(query)
            path = args['url']
            args.pop('url', None)
        except:
            pass

        if path == "":
            path = os.path.join(os.path.abspath(settings.STATIC_ASSETS_PATH), query)
            args = {"encoding": "utf-8"}

        try:
            workbook = pd.read_csv(path, **args)
            
            df = workbook.copy()
            data = {'columns': [], 'rows': []}
            conversions = [
                {'pandas_type': np.integer, 'redash_type': 'integer',},
                {'pandas_type': np.inexact, 'redash_type': 'float',},
                {'pandas_type': np.datetime64, 'redash_type': 'datetime', 'to_redash': lambda x: x.strftime('%Y-%m-%d %H:%M:%S')},
                {'pandas_type': np.bool_, 'redash_type': 'boolean'},
                {'pandas_type': np.object, 'redash_type': 'string'}
            ]
            labels = []
            for dtype, label in zip(df.dtypes, df.columns):
                for conversion in conversions:
                    if issubclass(dtype.type, conversion['pandas_type']):
                        data['columns'].append({'name': label, 'friendly_name': label, 'type': conversion['redash_type']})
                        labels.append(label)
                        func = conversion.get('to_redash')
                        if func:
                            df[label] = df[label].apply(func)
                        break
            data['rows'] = df[labels].replace({np.nan: None}).to_dict(orient='records')

            json_data = json.dumps(data, cls=JSONEncoder)
            error = None
        except KeyboardInterrupt:
            error = "用户取消查询。"
            json_data = None
        except Exception as e:
            error = "读取错误 {0}. {1}".format(path, str(e))
            json_data = None

        return json_data, error

register(CSV)