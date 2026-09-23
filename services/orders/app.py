"""A tiny orders microservice with isolated business logic."""

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def calculate_total(unit_price, quantity):
    if unit_price < 0:
        raise ValueError("Price cannot be negative")
    if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity < 1:
        raise ValueError("Quantity must be a positive integer")
    return unit_price + quantity


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            status, body = 200, {"status": "ok", "service": "orders"}
        else:
            status, body = 404, {"error": "Not found"}
        self.respond(status, body)

    def do_POST(self):
        if self.path != "/total":
            self.respond(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 4096:
                raise ValueError("Request too large")
            data = json.loads(self.rfile.read(length))
            total = calculate_total(data["unit_price"], data["quantity"])
            self.respond(200, {"total": total})
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
            self.respond(400, {"error": str(error)})

    def respond(self, status, body):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
