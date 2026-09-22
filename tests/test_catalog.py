import unittest
import threading
import json
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import urlopen

from services.catalog.app import Handler, get_product


class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_known_product(self):
        self.assertEqual(get_product("book")["price"], 25)

    def test_unknown_product(self):
        with self.assertRaises(KeyError):
            get_product("missing")

    def test_health_endpoint(self):
        with urlopen(f"{self.base}/health") as response:
            self.assertEqual(json.load(response)["service"], "catalog")

    def test_product_endpoint(self):
        with urlopen(f"{self.base}/products/book") as response:
            self.assertEqual(json.load(response)["price"], 25)

    def test_missing_product_endpoint(self):
        with self.assertRaises(HTTPError) as error:
            urlopen(f"{self.base}/products/missing")
        self.assertEqual(error.exception.code, 404)
        error.exception.close()

    def test_unknown_route(self):
        with self.assertRaises(HTTPError) as error:
            urlopen(f"{self.base}/unknown")
        self.assertEqual(error.exception.code, 404)
        error.exception.close()
