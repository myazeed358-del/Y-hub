import unittest
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from math_core.linear_algebra.engine import handle_linear_algebra

class DummyReq:
    def __init__(self, operation, mode, input_data):
        self.operation = operation
        self.mode = mode
        self.input = input_data

class TestLinearAlgebraPython(unittest.TestCase):
    def test_rref(self):
        req = DummyReq('rref', 'exact', {'matrices': [[[1, 2], [3, 4]]]})
        res = handle_linear_algebra(req)
        self.assertEqual(res['status'], 'solved')
        self.assertTrue(len(res['result']) > 0)

    def test_svd_numerical(self):
        req = DummyReq('svd', 'numerical', {'matrices': [[[1, 2], [3, 4]]]})
        res = handle_linear_algebra(req)
        self.assertEqual(res['status'], 'solved')
        self.assertIn('U', res['result'])

    def test_eigen_exact(self):
        req = DummyReq('eigen', 'exact', {'matrices': [[[4, -2], [1, 1]]]})
        res = handle_linear_algebra(req)
        self.assertEqual(res['status'], 'solved')
        self.assertIn('eigenvalues', res['result'])

if __name__ == '__main__':
    unittest.main()

