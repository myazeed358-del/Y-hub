import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

import sympy as sp

ROOT = Path(__file__).resolve().parents[2]

for path in (ROOT, ROOT / "python"):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from math_core.shared.ast_bridge import ASTBridge
from math_core.calculus.engine import handle_calculus
from math_core.linear_algebra.engine import handle_linear_algebra
from python.api.server import app, compute, MathRequest, MathResponse

try:
    from fastapi.testclient import TestClient
except ImportError:
    TestClient = None


def symbol(name):
    return {"type": "Symbol", "name": name}


def number(value):
    return {"type": "Number", "value": str(value)}


def operator(name, *args):
    return {
        "type": "Operator",
        "operator": name,
        "args": list(args),
    }


def api_result(phase, operation, data, mode="exact"):
    request = MathRequest(
        phase=phase,
        operation=operation,
        input=data,
        mode=mode,
    )

    raw = compute(request)
    validated = MathResponse.model_validate(raw)

    return json.loads(validated.model_dump_json())


MATRIX = {"matrices": [[[1, 2], [3, 4]]]}

CALCULUS = {
    "expression": operator(
        "^", symbol("x"), number(2)
    ),
    "variable": symbol("x"),
}

ODE = {
    "equation": {
        "type": "Equation",
        "lhs": {
            "type": "Derivative",
            "expression": symbol("y"),
            "variable": symbol("x"),
            "order": 1,
        },
        "rhs": symbol("y"),
    },
    "independentVariable": symbol("x"),
    "dependentVariable": symbol("y"),
}

FUZZY = {
    "operation": "add",
    "f1_cuts": [
        {"alpha": 0.5, "lower": 1, "upper": 2}
    ],
    "f2_cuts": [
        {"alpha": 0.5, "lower": 3, "upper": 4}
    ],
}


class TestApiContract(unittest.TestCase):

    def test_ast_limit_json_roundtrip(self):
        x = sp.Symbol("x")

        for direction in ("+", "-"):
            with self.subTest(direction=direction):
                expression = sp.Limit(
                    1 / x, x, 0, dir=direction
                )

                encoded = ASTBridge.to_ast(
                    expression, simplify=False
                )

                self.assertEqual(
                    encoded["direction"], direction
                )

                json.dumps(encoded)

                self.assertEqual(
                    ASTBridge.to_sympy(encoded),
                    expression,
                )

    def test_direct_engine_status(self):
        requests = [
            (
                handle_linear_algebra,
                SimpleNamespace(
                    operation="rref",
                    mode="exact",
                    input=MATRIX,
                ),
            ),
            (
                handle_calculus,
                SimpleNamespace(
                    operation="differentiate",
                    mode="exact",
                    input=CALCULUS,
                ),
            ),
        ]

        for handler, request in requests:
            with self.subTest(handler=handler.__name__):
                result = handler(request)
                self.assertEqual(
                    result["status"], "solved"
                )

    def test_matrix_rref_json(self):
        result = api_result("10", "rref", MATRIX)

        self.assertEqual(result["status"], "solved")
        self.assertEqual(
            result["result"],
            [[1, 0], [0, 1]],
        )

    def test_matrix_determinant_json(self):
        result = api_result(
            "10", "determinant", MATRIX
        )

        self.assertEqual(result["status"], "solved")
        self.assertEqual(result["result"], -2)

    def test_matrix_inverse_exact_fraction(self):
        result = api_result("10", "inverse", MATRIX)

        self.assertEqual(result["status"], "solved")
        self.assertEqual(
            result["result"],
            [[-2, 1], ["3/2", "-1/2"]],
        )

    def test_matrix_eigen_json(self):
        result = api_result("10", "eigen", MATRIX)

        self.assertEqual(result["status"], "solved")
        self.assertTrue(
            result["result"]["eigenvalues"]
        )

    def test_matrix_svd_json(self):
        result = api_result(
            "10", "svd",
            {"matrices": [[[1, 0], [0, 2]]]},
            mode="numerical",
        )

        self.assertEqual(result["status"], "solved")
        self.assertIn("Sigma", result["result"])

    def test_calculus_derivative(self):
        result = api_result(
            "6", "differentiate", CALCULUS
        )

        self.assertEqual(result["status"], "solved")
        self.assertIsNotNone(result["result"])

    def test_calculus_integration(self):
        result = api_result(
            "6", "integrate", CALCULUS
        )

        self.assertEqual(result["status"], "solved")
        self.assertIsNotNone(result["result"])

    def test_ode_status_classification(self):
        result = api_result(
            "7", "solve_ode", ODE
        )

        self.assertEqual(result["status"], "solved")
        self.assertTrue(result["result"])
        self.assertTrue(
            result["classification"].startswith(
                "EXACT_SYMBOLIC_ODE"
            )
        )

    def test_fuzzy_success(self):
        result = api_result(
            "fuzzy", "fuzzy_arithmetic",
            FUZZY, mode="auto",
        )

        self.assertEqual(result["status"], "solved")
        self.assertEqual(
            result["result"]["cuts"][0]["lower"],
            4,
        )

    def test_fuzzy_invalid_division(self):
        data = {
            **FUZZY,
            "operation": "div",
            "f2_cuts": [
                {
                    "alpha": 0.5,
                    "lower": -1,
                    "upper": 1,
                }
            ],
        }

        result = api_result(
            "fuzzy", "fuzzy_arithmetic",
            data, mode="auto",
        )

        self.assertEqual(
            result["status"], "invalid_domain"
        )
        self.assertIsNone(result["result"])
        self.assertTrue(result["errors"])

    def test_fuzzy_stub_not_solved(self):
        result = api_result(
            "fuzzy", "fuzzy_inference",
            {}, mode="numerical",
        )

        self.assertEqual(
            result["status"], "unsupported"
        )
        self.assertIsNone(result["result"])
        self.assertIn(
            "fuzzy_inference_not_implemented",
            result["warnings"]
        )


@unittest.skipUnless(
    TestClient is not None,
    "HTTP test dependency is unavailable",
)
class TestHttpContract(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()

    def test_health_http_200(self):
        response = self.client.get(
            "/api/v1/math/health"
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            response.json()["symbolic_test"]
        )

    def test_unsupported_phase_http_400(self):
        response = self.client.post(
            "/api/v1/math/compute",
            json={
                "phase": "unknown",
                "mode": "exact",
                "operation": "test",
                "input": {},
            },
        )

        self.assertEqual(response.status_code, 400)

    def test_invalid_request_http_422(self):
        response = self.client.post(
            "/api/v1/math/compute",
            json={"phase": "10"},
        )

        self.assertEqual(response.status_code, 422)

    def test_matrix_result_http_200(self):
        response = self.client.post(
            "/api/v1/math/compute",
            json={
                "phase": "10",
                "mode": "exact",
                "operation": "determinant",
                "input": MATRIX,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["result"], -2
        )


    def test_unexpected_handler_error_http_500(self):
        from unittest.mock import patch

        with patch(
            "python.api.server.handle_linear_algebra",
            side_effect=RuntimeError(
                "simulated_internal_failure"
            ),
        ):
            response = self.client.post(
                "/api/v1/math/compute",
                json={
                    "phase": "10",
                    "mode": "exact",
                    "operation": "determinant",
                    "input": {
                        "matrices": [[[1, 2], [3, 4]]]
                    },
                },
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json()["detail"],
            "Internal math computation error",
        )
        self.assertNotIn(
            "simulated_internal_failure",
            response.text,
        )


if __name__ == "__main__":
    unittest.main()
