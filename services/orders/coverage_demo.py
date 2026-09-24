"""Untested demo code used to show the CI coverage gate."""


def calculate_discount(price, customer_tier, coupon=None):
    if price < 0:
        raise ValueError("Price cannot be negative")

    if customer_tier == "gold":
        rate = 0.20
    elif customer_tier == "silver":
        rate = 0.10
    else:
        rate = 0.0

    if coupon == "SAVE5":
        rate += 0.05

    rate = min(rate, 0.25)
    discount = price * rate
    return round(price - discount, 2)


def describe_discount(original_price, final_price):
    if original_price == 0:
        return "No discount"
    percent = (original_price - final_price) / original_price * 100
    return f"Saved {percent:.0f}%"
