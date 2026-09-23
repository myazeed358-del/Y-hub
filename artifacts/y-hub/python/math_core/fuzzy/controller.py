import numpy as np

def execute_controller(data):
    controller = data.get('controller', {})
    inputs = data.get('inputs', {})
    
    config = controller.get('configuration', {})
    inf_method = config.get('inferenceMethod')
    
    # Repackage for existing F8/F9 handlers
    req = {
        'ruleBase': controller.get('ruleBase', {}),
        'inputs': inputs,
        'outputVariables': controller.get('outputVariables', {}),
        'config': config
    }
    
    global_status = 'success'
    outputs = {}
    rule_evals = []
    
    try:
        if inf_method == 'mamdani':
            from .mamdani import execute_mamdani
            res = execute_mamdani(req)
        elif inf_method.startswith('sugeno'):
            from .sugeno import execute_sugeno
            res = execute_sugeno(req)
        elif inf_method == 'tsukamoto':
            from .tsukamoto import execute_tsukamoto
            res = execute_tsukamoto(req)
        else:
            raise ValueError(f"Unknown inference method {inf_method}")
            
        outputs = res.get('outputs', {})
        rule_evals = res.get('ruleEvaluations', [])
        global_status = res.get('status', 'success')
        
    except ValueError as ve:
        err_msg = str(ve)
        return {
            'status': 'outside_domain' if err_msg.startswith('outside_domain') else 'invalid_configuration',
            'warnings': [err_msg]
        }
        
    # Verification pass
    failures = []
    out_vars = controller.get('outputVariables', {})
    for v_name, out in outputs.items():
        v_dom = out_vars[v_name]['domain']
        crisp = out.get('defuzzifiedValue')
        if crisp is None or np.isnan(crisp) or np.isinf(crisp):
            failures.append(f"Output {v_name} is NaN or Infinity.")
            continue
        if float(crisp) < float(v_dom[0]) or float(crisp) > float(v_dom[1]):
            failures.append(f"Output {v_name} value {crisp} exceeds declared domain.")
            
    is_valid = len(failures) == 0
    if not is_valid and global_status == 'success':
        global_status = 'verification_failed'
        
    return {
        'provider': 'python_numpy',
        'inferenceMethod': inf_method,
        'mathematicalExactness': res.get('mathematicalExactness'),
        'representationAccuracy': res.get('representationAccuracy'),
        'status': global_status,
        'warnings': failures,
        'verification': { 'isValid': is_valid, 'failures': failures },
        'outputs': outputs,
        'ruleEvaluations': rule_evals,
        'visualizationData': { 'outputs': outputs }
    }
