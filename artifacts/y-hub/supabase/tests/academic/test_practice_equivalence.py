"""Real PostgreSQL guards for bounded derivative equivalence, not model similarity."""
import json
import subprocess
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from support import run, value, U, I, A, S, O
from test_practice_sources import setup, literal
from test_practice_sessions import create, read, publish


def computed(coefficients=None, variable='x', language='en', reverse=False):
    # Execute the deployed engine adapter; never invent a verification claim.
    task = {'kind': 'polynomial_derivative', 'variable': variable,
            'coefficients': coefficients or [1, -5, 2, 1],
            'options': [[-5, 4, 3], [0], [1], [2]]}
    if reverse:
        task['options'].reverse()
    module = (Path(__file__).resolve().parents[2] / 'functions/_shared/tutor/polynomialVerifier.mjs').as_uri()
    code = 'import {verifyDerivative} from ' + json.dumps(module) + ';process.stdout.write(JSON.stringify(verifyDerivative(' + json.dumps(task) + ',' + json.dumps(language) + ')));'
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', code], text=True, timeout=10))


def append(sid, source, result=None, position=1, actor=U, check=True):
    result = result or computed()
    chunk = value(f"SELECT id FROM public.ai_tutor_chunks WHERE source_id='{source['sourceId']}' ORDER BY ordinal LIMIT 1")
    return run(f"SET LOCAL ROLE service_role;SELECT public.publish_ai_practice_math_question('{actor}','{sid}',{position},{literal(result['question'])},ARRAY['{chunk}'::uuid],{literal(result['verification'])})", check=check)


class PracticeEquivalence(unittest.TestCase):
    def test_changed_constant_variable_language_options_are_not_new_exercises(self):
        course, source = setup()
        original = create(course, source)
        append(original, source)
        for kwargs in [dict(coefficients=[9, -5, 2, 1]), dict(variable='t'),
                       dict(language='ar'), dict(reverse=True), dict(coefficients=[1, -5, 2, 1, 0])]:
            sid = create(course, source)
            result = append(sid, source, computed(**kwargs), check=False)
            self.assertNotEqual(result.returncode, 0, kwargs)
            self.assertIn('Repeated', result.stderr)
            self.assertEqual(read(sid)['revision'], 1)
            self.assertEqual(read(sid)['questions'], [])

    def test_deliberate_retraining_allows_history_but_not_same_session_duplicates(self):
        course, source = setup()
        append(create(course, source), source)
        sid = create(course, source, repeat=True)
        append(sid, source, computed(variable='t'))
        rejected = append(sid, source, computed(language='ar'), position=2, check=False)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertEqual(len(read(sid)['questions']), 1)

    def test_two_concurrent_sessions_cannot_admit_equivalent_tasks(self):
        course, source = setup()
        sessions = [create(course, source) for _ in range(2)]
        proposals = [computed(), computed(variable='t')]
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda i: append(sessions[i], source, proposals[i], check=False), range(2)))
        self.assertEqual(sum(r.returncode == 0 for r in results), 1)
        self.assertEqual(sum(len(read(s)['questions']) for s in sessions), 1)

    def test_different_nonconstant_coefficients_are_not_conflated(self):
        course, source = setup()
        append(create(course, source), source)
        # A different function has a different exact derivative, even with a
        # similar-looking prompt. The adapter checks this answer independently.
        result = computed()
        result['verification']['task']['coefficients'] = [1, -5, 2, 2]
        result['verification']['task']['options'][0] = [-5, 4, 6]
        module = (Path(__file__).resolve().parents[2] / 'functions/_shared/tutor/polynomialVerifier.mjs').as_uri()
        code = 'import {verifyDerivative} from ' + json.dumps(module) + ';process.stdout.write(JSON.stringify(verifyDerivative(' + json.dumps(result['verification']['task']) + ',"en")));'
        other = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', code], text=True))
        sid = create(course, source)
        append(sid, source, other)
        self.assertEqual(len(read(sid)['questions']), 1)

    def test_identity_never_crosses_student_or_section_boundaries(self):
        course, source = setup()
        append(create(course, source), source)
        # Course instructor's own practice history is separate from the student's.
        sid = create(course, source, actor=I)
        append(sid, source, actor=I)
        self.assertEqual(len(read(sid, I)['questions']), 1)
        other, other_source = setup()
        sid = create(other, other_source)
        append(sid, other_source)
        self.assertEqual(len(read(sid)['questions']), 1)

    def test_identity_is_private_and_cannot_be_set_by_browser_or_service_directly(self):
        course, source = setup()
        sid = create(course, source)
        append(sid, source)
        for actor in [U, I, A, S, O]:
            self.assertNotEqual(run('SELECT derivative_identity FROM practice_private.questions', actor, False).returncode, 0)
            self.assertNotEqual(run("SELECT practice_private.derivative_identity('{}')", actor, False).returncode, 0)
        self.assertNotEqual(run("SET LOCAL ROLE service_role;UPDATE practice_private.questions SET derivative_identity='forged'", check=False).returncode, 0)
        state = read(sid)
        self.assertNotIn('derivative_identity', json.dumps(state))
        self.assertIsNone(state['questions'][0]['feedback'])

    def test_invalid_metadata_has_no_identity_and_cannot_be_published(self):
        course, source = setup()
        for coefficients in [None, [], [0.5], [101], ['1'], [True], [1] * 10]:
            result = computed()
            result['verification']['task']['coefficients'] = coefficients
            proof = literal(result['verification'])
            self.assertEqual(value(f'SELECT practice_private.derivative_identity({proof}) IS NULL'), 't')
            sid = create(course, source)
            self.assertNotEqual(append(sid, source, result, check=False).returncode, 0)
            self.assertEqual(read(sid)['revision'], 1)

    def test_history_beyond_prompt_window_still_prevents_equivalence(self):
        course, source = setup()
        first = create(course, source, target=30)
        append(first, source)
        for position in range(2, 24):
            publish(first, source, position, f'Distinct theoretical exercise {position}')
        sid = create(course, source)
        context = json.loads(value(f"SET LOCAL ROLE service_role;SELECT public.ai_practice_generation_context('{U}','{sid}',1)"))
        self.assertEqual(len(context['previous']), 20)
        self.assertEqual(context['previousDerivativeInputs'], [[1, -5, 2, 1]])
        self.assertNotEqual(append(sid, source, computed(language='ar'), check=False).returncode, 0)

    def test_retry_after_lost_acknowledgement_is_still_idempotent(self):
        course, source = setup()
        sid = create(course, source)
        append(sid, source)
        append(sid, source, computed(variable='t'))
        self.assertEqual(read(sid)['revision'], 2)
        self.assertIn('f(x)', read(sid)['questions'][0]['prompt'])

    def test_rejected_source_does_not_poison_history(self):
        course, source = setup()
        _, foreign_source = setup()
        sid = create(course, source)
        self.assertNotEqual(append(sid, foreign_source, check=False).returncode, 0)
        self.assertEqual(read(sid)['revision'], 1)
        retry = create(course, source)
        append(retry, source)
        self.assertEqual(len(read(retry)['questions']), 1)

    def test_ordinary_questions_never_get_speculative_math_identity(self):
        course, source = setup()
        sid = create(course, source)
        publish(sid, source)
        self.assertEqual(value(f"SELECT derivative_identity IS NULL FROM practice_private.questions WHERE session_id='{sid}'"), 't')

    def test_constant_zero_trailing_zeros_and_unknown_contracts(self):
        proof = computed()['verification']
        keys = []
        for coefficients in [[0], [5], [-100, 0, 0], [0.0, -0.0]]:
            candidate = {**proof, 'task': {**proof['task'], 'coefficients': coefficients}}
            keys.append(value(f'SELECT practice_private.derivative_identity({literal(candidate)})'))
        self.assertEqual(len(set(keys)), 1)
        for patch in [{'method': 'future-unimplemented-v2'}, {'task': {**proof['task'], 'kind': 'integral'}}, {'task': {**proof['task'], 'variable': 'z'}}]:
            candidate = {**proof, **patch}
            self.assertEqual(value(f'SELECT practice_private.derivative_identity({literal(candidate)}) IS NULL'), 't')
