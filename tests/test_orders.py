import unittest
import json
import threading
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from services.orders.app import Handler, calculate_total


class OrderTests(unittest.TestCase):
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

    def post(self, path, body):
        return urlopen(Request(f"{self.base}{path}", data=json.dumps(body).encode(),
                               headers={"Content-Type": "application/json"}))

    def test_total(self):
        self.assertEqual(calculate_total(25, 2), 50)

    def test_rejects_zero_quantity(self):
        with self.assertRaises(ValueError):
            calculate_total(25, 0)

    def test_rejects_negative_price(self):
        with self.assertRaises(ValueError):
            calculate_total(-1, 2)

    def test_rejects_boolean_quantity(self):
        with self.assertRaises(ValueError):
            calculate_total(25, True)

    def test_health_endpoint(self):
        with urlopen(f"{self.base}/health") as response:
            self.assertEqual(json.load(response)["service"], "orders")

    def test_total_endpoint(self):
        with self.post("/total", {"unit_price": 25, "quantity": 2}) as response:
            self.assertEqual(json.load(response)["total"], 50)

    def test_invalid_order_endpoint(self):
        with self.assertRaises(HTTPError) as error:
            self.post("/total", {"unit_price": 25, "quantity": 0})
        self.assertEqual(error.exception.code, 400)
        error.exception.close()

    def test_unknown_post_route(self):
        with self.assertRaises(HTTPError) as error:
            self.post("/missing", {})
        self.assertEqual(error.exception.code, 404)
        error.exception.close()

    def test_unknown_get_route(self):
        with self.assertRaises(HTTPError) as error:
            urlopen(f"{self.base}/missing")
        self.assertEqual(error.exception.code, 404)
        error.exception.close()
