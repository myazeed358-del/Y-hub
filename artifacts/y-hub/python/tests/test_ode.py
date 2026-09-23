import unittest
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from math_core.ode.engine import handle_ode
from math_core.shared.ast_bridge import ASTBridge
import sympy as sp

class DummyReq:
    def __init__(self, operation, mode, input_data, phase):
        self.operation = operation
        self.mode = mode
        self.input = input_data
        self.phase = phase

class TestODEPython(unittest.TestCase):
    def test_solve_ode(self):
        # y' = y
        req = DummyReq('solve_ode', 'exact', {
            'equation': {
                'type': 'Equation',
                'lhs': {
                    'type': 'Derivative',
                    'expression': {'type': 'Symbol', 'name': 'y'},
                    'variable': {'type': 'Symbol', 'name': 'x'},
                    'order': 1
                },
                'rhs': {'type': 'Symbol', 'name': 'y'}
            },
            'independentVariable': {'type': 'Symbol', 'name': 'x'},
            'dependentVariable': {'type': 'Symbol', 'name': 'y'}
        }, '7')
        res = handle_ode(req)
        self.assertTrue('EXACT_SYMBOLIC_ODE' in res['classification'])

    def test_lost_equilibrium(self):
        # y' = y * (1 - y)
        req = DummyReq('solve_ode', 'exact', {
            'equation': {
                'type': 'Equation',
                'lhs': {
                    'type': 'Derivative',
                    'expression': {'type': 'Symbol', 'name': 'y'},
                    'variable': {'type': 'Symbol', 'name': 'x'},
                    'order': 1
                },
                'rhs': {
                    'type': 'Operator', 'operator': '*', 'args': [
                        {'type': 'Symbol', 'name': 'y'},
                        {'type': 'Operator', 'operator': '-', 'args': [
                            {'type': 'Number', 'value': '1'},
                            {'type': 'Symbol', 'name': 'y'}
                        ]}
                    ]
                }
            },
            'independentVariable': {'type': 'Symbol', 'name': 'x'},
            'dependentVariable': {'type': 'Symbol', 'name': 'y'}
        }, '7')
        res = handle_ode(req)
        # Check if conditions picked up y=0 and y=1
        self.assertTrue(len(res['conditions']) >= 1)
        self.assertEqual(res['conditions'][0]['type'], 'EquilibriumSolution')

    def test_system_ode(self):
        req = DummyReq('solve_system_ode', 'exact', {
            'equations': [
                {
                    'type': 'Equation',
                    'lhs': {
                        'type': 'Derivative',
                        'expression': {'type': 'Symbol', 'name': 'x'},
                        'variable': {'type': 'Symbol', 'name': 't'},
                        'order': 1
                    },
                    'rhs': {'type': 'Symbol', 'name': 'y'}
                },
                {
                    'type': 'Equation',
                    'lhs': {
                        'type': 'Derivative',
                        'expression': {'type': 'Symbol', 'name': 'y'},
                        'variable': {'type': 'Symbol', 'name': 't'},
                        'order': 1
                    },
                    'rhs': {'type': 'Symbol', 'name': 'x'}
                }
            ],
            'independentVariable': {'type': 'Symbol', 'name': 't'},
            'dependentVariables': [{'name': 'x'}, {'name': 'y'}]
        }, '9')
        res = handle_ode(req)
        self.assertEqual(res['classification'], 'SYSTEM_ODE_EXACT')
        self.assertEqual(len(res['result']), 2)

    def test_phase_plane(self):
        req = DummyReq('phase_plane', 'numerical', {
            'eq1': {'type': 'Symbol', 'name': 'y'},
            'eq2': {'type': 'Symbol', 'name': 'x'},
            'x_var': 'x',
            'y_var': 'y',
            'bounds': {'x_min': -5, 'x_max': 5, 'y_min': -5, 'y_max': 5}
        }, '9')
        res = handle_ode(req)
        self.assertEqual(res['classification'], 'PHASE_PLANE_DATA')
        self.assertIn('u_grid', res['result'])

if __name__ == '__main__':
    unittest.main()
