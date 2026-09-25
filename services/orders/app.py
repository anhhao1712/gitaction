"""A tiny orders microservice with isolated business logic."""

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def calculate_total(unit_price, quantity):
    if unit_price < 0:
        raise ValueError("Price cannot be negative")
    if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity < 1:
        raise ValueError("Quantity must be a positive integer")
    return unit_price * quantity

# ===== DEMO COVERAGE THẤP =====

def calculate_discount(price, customer_type, coupon=None):
    if price < 0:
        raise ValueError("Price cannot be negative")

    if customer_type == "gold":
        discount_rate = 0.20
    elif customer_type == "silver":
        discount_rate = 0.10
    elif customer_type == "student":
        discount_rate = 0.05
    else:
        discount_rate = 0

    if coupon == "SAVE10":
        discount_rate += 0.10
    elif coupon == "SAVE5":
        discount_rate += 0.05

    if discount_rate > 0.30:
        discount_rate = 0.30

    discount = price * discount_rate
    final_price = price - discount
    return round(final_price, 2)


def calculate_shipping(subtotal, zone, express=False):
    if subtotal < 0:
        raise ValueError("Subtotal cannot be negative")

    if zone == "domestic":
        shipping_fee = 20
    elif zone == "international":
        shipping_fee = 50
    elif zone == "remote":
        shipping_fee = 70
    else:
        raise ValueError("Unknown shipping zone")

    if express:
        shipping_fee += 30

    if subtotal >= 500:
        shipping_fee = 0

    return shipping_fee

# ===== KẾT THÚC DEMO =====

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
