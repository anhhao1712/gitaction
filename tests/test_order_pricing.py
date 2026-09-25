import unittest

from services.orders.app import calculate_discount, calculate_shipping


class DiscountTests(unittest.TestCase):
    def test_rejects_negative_price(self):
        with self.assertRaises(ValueError):
            calculate_discount(-1, "regular")

    def test_caps_combined_discount(self):
        self.assertEqual(calculate_discount(100, "gold", "SAVE15"), 70)

    def test_silver_customer_with_coupon(self):
        self.assertEqual(calculate_discount(100, "silver", "SAVE5"), 85)

    def test_student_discount(self):
        self.assertEqual(calculate_discount(100, "student"), 95)

    def test_regular_customer_without_coupon(self):
        self.assertEqual(calculate_discount(100, "regular"), 100)


class ShippingTests(unittest.TestCase):
    def test_rejects_negative_subtotal(self):
        with self.assertRaises(ValueError):
            calculate_shipping(-1, "domestic")

    def test_domestic_shipping(self):
        self.assertEqual(calculate_shipping(100, "domestic"), 20)

    def test_international_express_shipping(self):
        self.assertEqual(calculate_shipping(100, "international", express=True), 80)

    def test_remote_shipping(self):
        self.assertEqual(calculate_shipping(100, "remote"), 70)

    def test_unknown_zone(self):
        with self.assertRaises(ValueError):
            calculate_shipping(100, "unknown")

    def test_free_shipping_for_large_order(self):
        self.assertEqual(calculate_shipping(500, "domestic", express=True), 0)


if __name__ == "__main__":
    unittest.main()
