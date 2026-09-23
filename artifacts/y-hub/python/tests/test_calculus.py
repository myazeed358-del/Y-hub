import unittest
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from math_core.calculus.engine import handle_calculus
from math_core.shared.ast_bridge import ASTBridge
import sympy as sp

class DummyReq:
    def __init__(self, operation, mode, input_data):
        self.operation = operation
        self.mode = mode
        self.input = input_data
        self.phase = '6'

class TestCalculusPython(unittest.TestCase):
    def test_integrate_indefinite(self):
        req = DummyReq('integrate', 'exact', {
            'expression': {'type': 'Operator', 'operator': '^', 'args': [
                {'type': 'Symbol', 'name': 'x'},
                {'type': 'Number', 'value': '2'}
            ]},
            'variable': {'type': 'Symbol', 'name': 'x'}
        })
        res = handle_calculus(req)
        self.assertEqual(res['status'], 'solved')
        self.assertIn('result', res)

    def test_integrate_definite(self):
        req = DummyReq('integrate', 'exact', {
            'expression': {'type': 'Symbol', 'name': 'x'},
            'variable': {'type': 'Symbol', 'name': 'x'},
            'lowerBound': {'type': 'Number', 'value': '0'},
            'upperBound': {'type': 'Number', 'value': '1'}
        })
        res = handle_calculus(req)
        self.assertEqual(res['status'], 'solved')

    def test_domain_preservation(self):
        # 1/(x-1)
        req = DummyReq('integrate', 'exact', {
            'expression': {'type': 'Operator', 'operator': '/', 'args': [
                {'type': 'Number', 'value': '1'},
                {'type': 'Operator', 'operator': '-', 'args': [
                    {'type': 'Symbol', 'name': 'x'},
                    {'type': 'Number', 'value': '1'}
                ]}
            ]},
            'variable': {'type': 'Symbol', 'name': 'x'}
        })
        res = handle_calculus(req)
        # Should have domain restrictions
        self.assertTrue(len(res['conditions']) > 0)
        
    def test_divergent_improper(self):
        # 1/x from 0 to 1
        req = DummyReq('integrate', 'exact', {
            'expression': {'type': 'Operator', 'operator': '/', 'args': [
                {'type': 'Number', 'value': '1'},
                {'type': 'Symbol', 'name': 'x'}
            ]},
            'variable': {'type': 'Symbol', 'name': 'x'},
            'lowerBound': {'type': 'Number', 'value': '0'},
            'upperBound': {'type': 'Number', 'value': '1'}
        })
        res = handle_calculus(req)
        self.assertEqual(res['classification'], 'divergent')

if __name__ == '__main__':
    unittest.main()
