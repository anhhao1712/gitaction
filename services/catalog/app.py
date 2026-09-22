"""A tiny catalog microservice, using only the Python standard library."""

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


PRODUCTS = {
    "book": {"name": "CI Handbook", "price": 25},
    "pen": {"name": "Blue Pen", "price": 3},
}


def get_product(product_id):
    """Return a product or raise a clear domain error."""
    if product_id not in PRODUCTS:
        raise KeyError(f"Unknown product: {product_id}")
    return {"id": product_id, **PRODUCTS[product_id]}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            status, body = 200, {"status": "ok", "service": "catalog"}
        elif self.path.startswith("/products/"):
            try:
                status, body = 200, get_product(self.path.removeprefix("/products/"))
            except KeyError as error:
                status, body = 404, {"error": str(error)}
        else:
            status, body = 404, {"error": "Not found"}
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
