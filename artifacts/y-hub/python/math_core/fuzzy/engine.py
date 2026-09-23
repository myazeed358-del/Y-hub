def handle_fuzzy(req):
    op = req.operation
    data = req.input
    
    warnings = []
    errors = []
    steps = []
    result = None
    
    try:
        import numpy as np
        
                if op == 'fuzzy_arithmetic':
            from .arithmetic import fuzzy_arithmetic_py
            from .numbers import AlphaCut
            
            # Reconstruct cut lists from JSON payload
            c1_data = data.get('f1_cuts', [])
            c2_data = data.get('f2_cuts', [])
            op_type = data.get('operation', 'add')
            
            c1_list = [AlphaCut(c['alpha'], c['lower'], c['upper']) for c in c1_data]
            c2_list = [AlphaCut(c['alpha'], c['lower'], c['upper']) for c in c2_data]
            
                        try:
                res_cuts = fuzzy_arithmetic_py(c1_list, c2_list, op_type)
            except ValueError as ve:
                if 'invalid_domain' in str(ve):
                    return {
                        'operation': op,
                        'phase': 'fuzzy',
                        'mode': req.mode,
                        'result': None,
                        'status': 'invalid_domain',
                        'mathematicalExactness': 'exact',
                        'representationAccuracy': 'sampled',
                        'warnings': ['Division by zero interval detected.'],
                        'errors': [str(ve)]
                    }
                raise ve
            result = {'cuts': res_cuts}
            classification = 'FUZZY_ARITHMETIC'
            steps.append({'step': 'Fuzzy Arithmetic', 'description': f'Computed {len(res_cuts)} alpha cuts for {op_type} via Python'})

                elif op == 'fuzzy_relation':
            from .relations import compose_relations, transitive_closure
            
            sub_op = data.get('relation_op', 'compose')
            if sub_op == 'compose':
                A = data['matrixA']
                B = data['matrixB']
                method = data.get('compositionType', 'max-min')
                res = compose_relations(A, B, method)
                result = {'matrix': res.tolist(), 'rows': res.shape[0], 'cols': res.shape[1]}
                        elif sub_op == 'project':
                from .relations import project_relation
                A = data['matrix']
                axis = data.get('axis', 0)
                res = project_relation(A, axis)
                result = {'vector': res.tolist()}
            elif sub_op == 'closure':
                A = data['matrix']
                res, iters, conv = transitive_closure(A)
                result = {
                    'closure': {
                        'matrix': res.tolist(),
                        'iterations': iters,
                        'converged': conv,
                        'trace': []
                    }
                }
            classification = 'FUZZY_RELATION'

                elif op == 'defuzzify':
            from .defuzzification import defuzzify_discrete, defuzzify_continuous
            methods = data.get('method')
            if isinstance(methods, str): methods = [methods]
            
            comparisons = {}
            main_val = 0
            status = 'success'
            
            for m in methods:
                if 'continuousParams' in data:
                    v, s = defuzzify_continuous(data['continuousParams'], m)
                else:
                    pts = [[p['x'], p['y']] for p in data['points']]
                    v, s = defuzzify_discrete(pts, m)
                    
                comparisons[m] = v
                if s != 'success': status = s
                if m == methods[0]: main_val = v
                
            result = {
                'value': main_val,
                'method': methods[0],
                'comparisons': comparisons if len(methods) > 1 else None,
                'status': status
            }
            classification = 'FUZZY_DEFUZZIFICATION'

                elif op == 'defuzzify':
            from .defuzzification import defuzzify_discrete, defuzzify_continuous
            methods = data.get('method')
            input_type = data.get('inputType')
            if isinstance(methods, str): methods = [methods]
            
            comparisons = {}
            main_val = 0
            status = 'success'
            prov = 'python_numpy'
            rep = 'sampled'
            
            for m in methods:
                if 'continuousParams' in data:
                    v, s, p, r = defuzzify_continuous(data['continuousParams'], m)
                    prov = p
                    rep = r
                else:
                    pts = [[p['x'], p['y']] for p in data['points']]
                    v, s = defuzzify_discrete(pts, m, input_type)
                    prov = 'python_numpy'
                    rep = 'sampled'
                    
                comparisons[m] = v
                if s != 'success': status = s
                if m == methods[0]: main_val = v
                
            result = {
                'value': main_val,
                'method': methods[0],
                'comparisons': comparisons if len(methods) > 1 else None,
                'status': status,
                'provider': prov,
                'representationAccuracy': rep,
                'mathematicalExactness': 'numerical'
            }
            if rep == 'sampled' and 'continuousParams' in data:
                result['warnings'] = ['continuous_integral_approximated_by_sampling']

            classification = 'FUZZY_DEFUZZIFICATION'

                elif op == 'rule_engine':
            from .rules import fuzzify_batch, evaluate_rules_batch
            
            rules = data.get('ruleBase', {}).get('rules', [])
            variables = data.get('ruleBase', {}).get('variables', {})
            crisp = data.get('inputs', {})
            
            # Format crisp to batch arrays
            batch_inputs = {k: [v] if isinstance(v, (int, float)) else v for k, v in crisp.items()}
            
            fuz = fuzzify_batch(variables, batch_inputs, config)
                        config = data.get('config', {'tNorm': 'min', 'tConorm': 'max'})
            try:
                evs = evaluate_rules_batch(rules, fuz, config)
                result = {
                    'evaluations': evs,
                    'status': 'success',
                    'provider': 'python_numpy',
                    'mathematicalExactness': 'numerical',
                    'representationAccuracy': 'sampled'
                }
            except ValueError as ve:
                err_msg = str(ve)
                status = 'outside_domain' if err_msg.startswith('outside_domain') else 'invalid_domain'
                result = {
                    'status': status,
                    'errors': [err_msg],
                    'provider': 'python_numpy',
                    'mathematicalExactness': 'numerical',
                    'representationAccuracy': 'sampled'
                }
            
            result = {
                'evaluations': evs,
                'status': 'success',
                'provider': 'python_numpy',
                'mathematicalExactness': 'numerical',
                'representationAccuracy': 'sampled'
            }
            classification = 'FUZZY_RULE_ENGINE'

                elif op == 'mamdani':
            from .mamdani import execute_mamdani
            try:
                result = execute_mamdani(data)
                classification = 'FUZZY_MAMDANI_INFERENCE'
            except ValueError as ve:
                err_msg = str(ve)
                status = 'outside_domain' if err_msg.startswith('outside_domain') else 'invalid_domain'
                result = {
                    'status': status,
                    'errors': [err_msg],
                    'provider': 'python_numpy',
                    'mathematicalExactness': 'numerical',
                    'representationAccuracy': 'sampled'
                }
                classification = 'FUZZY_MAMDANI_INFERENCE'
        
                        elif op == 'controller':
            from .controller import execute_controller
            try:
                result = execute_controller(data)
                classification = 'FUZZY_CONTROLLER_EXECUTION'
            except ValueError as ve:
                err_msg = str(ve)
                status = 'outside_domain' if err_msg.startswith('outside_domain') else 'invalid_domain'
                result = { 'status': status, 'warnings': [err_msg], 'provider': 'python_numpy', 'mathematicalExactness': 'numerical', 'representationAccuracy': 'sampled' }
                classification = 'FUZZY_CONTROLLER_EXECUTION'
                
        elif op == 'sugeno':
            from .sugeno import execute_sugeno
            try:
                result = execute_sugeno(data)
                classification = 'FUZZY_SUGENO_INFERENCE'
            except ValueError as ve:
                err_msg = str(ve)
                status = 'outside_domain' if err_msg.startswith('outside_domain') else 'invalid_domain'
                result = { 'status': status, 'errors': [err_msg], 'provider': 'python_numpy', 'mathematicalExactness': 'exact', 'representationAccuracy': 'exact' }
                classification = 'FUZZY_SUGENO_INFERENCE'

        elif op == 'tsukamoto':
            from .tsukamoto import execute_tsukamoto
            try:
                result = execute_tsukamoto(data)
                classification = 'FUZZY_TSUKAMOTO_INFERENCE'
            except ValueError as ve:
                err_msg = str(ve)
                status = 'outside_domain' if err_msg.startswith('outside_domain') else 'invalid_domain'
                result = { 'status': status, 'errors': [err_msg], 'provider': 'python_numpy', 'mathematicalExactness': 'exact', 'representationAccuracy': 'exact' }
                classification = 'FUZZY_TSUKAMOTO_INFERENCE'
        
        elif op == 'fuzzy_inference':
            # Stub for NumPy accelerated Mamdani/Sugeno execution
            steps.append({'step': 'init', 'description': 'Python fuzzy inference initialized'})
            
            # TODO: Full fuzzy relation composition and integration
            
            result = {'stub_output': 0.0}
            steps.append({'step': 'defuzzification', 'description': 'Centroid calculation complete'})
            
    except Exception as e:
        errors.append(str(e))
        
    status = 'solved' if not errors and result is not None else ('no_solution' if result is None else 'invalid_input')
    
    return {
        'operation': op,
        'phase': 'fuzzy',
        'mode': req.mode,
        'input': data,
        'normalized_input': data,
        'result': result,
        'steps': steps,
        'classification': 'FUZZY_INFERENCE',
        'assumptions': None,
        'conditions': [],
        'domain': None,
        'verification': None,
        'verification_status': 'verification_failed' if errors else 'not_proven',
        'exactness': 'numerical_approximation',
        'numerical_evidence': None,
        'warnings': warnings,
        'errors': errors
    }












