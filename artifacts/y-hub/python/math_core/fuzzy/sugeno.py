import numpy as np
from .rules import fuzzify_batch, evaluate_rules_batch

def execute_sugeno(data):
    rule_base = data.get('ruleBase', {})
    rules = rule_base.get('rules', [])
    in_vars = rule_base.get('variables', {})
    out_vars = data.get('outputVariables', {})
    crisp = data.get('inputs', {})
    config = data.get('config', {})
    
    batch_inputs = {k: [v] if isinstance(v, (int, float)) else v for k, v in crisp.items()}
    fuz = fuzzify_batch(in_vars, batch_inputs, config)
    rule_evals = evaluate_rules_batch(rules, fuz, config)
    
    outputs = {}
    global_status = 'success'
    
    for var_name, out_var in out_vars.items():
        dom = out_var.get('domain', [0, 100])
        num_sum = 0.0
        den_sum = 0.0
        rule_outputs = []
        out_status = 'success'
        
        for ev in rule_evals:
            w = ev['firingStrength'][0]
            if w <= 0: continue
            
            for cons in ev['consequents']:
                if cons['variable'] != var_name: continue
                
                term_def = out_var['terms'][cons['term']]
                m_type = term_def['membership']['type']
                params = term_def['membership']['params']
                
                if m_type == 'constant':
                    z = params.get('value', 0)
                elif m_type == 'linear':
                    z = params.get('intercept', 0)
                    for k, v in crisp.items():
                        c_key = f"c_{k}"
                        if c_key in params:
                            z += params[c_key] * v
                else:
                    raise ValueError(f"Sugeno requires 'constant' or 'linear'. Got {m_type}")
                    
                num_sum += w * z
                den_sum += w
                
                rule_outputs.append({
                    'ruleId': ev['ruleId'],
                    'variable': var_name,
                    'term': cons['term'],
                    'firingStrength': float(w),
                    'z': float(z)
                })
                
        if den_sum == 0:
            out_status = 'zero_area'
            global_status = 'zero_area'
            final_crisp = 0.0
        else:
            final_crisp = num_sum / den_sum
            if final_crisp < dom[0] or final_crisp > dom[1]:
                out_status = 'invalid_domain'
                global_status = 'invalid_domain'
                
        outputs[var_name] = {
            'variable': var_name,
            'defuzzifiedValue': float(final_crisp),
            'status': out_status,
            'ruleOutputs': rule_outputs
        }
        
    return {
        'outputs': outputs,
        'ruleEvaluations': rule_evals,
        'provider': 'python_numpy',
        'status': global_status,
        'mathematicalExactness': 'exact',
        'representationAccuracy': 'exact',
        'verificationStatus': 'verified' if global_status == 'success' else 'failed'
    }
