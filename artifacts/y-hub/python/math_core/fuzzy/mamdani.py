import numpy as np
from .rules import fuzzify_batch, evaluate_rules_batch
from .defuzzification import defuzzify_discrete

def _eval_membership(x, m_type, params):
    if m_type == 'triangle':
        a, b, c = params['a'], params['b'], params['c']
        return np.where((x > a) & (x < c), np.where(x < b, (x - a) / (b - a), (c - x) / (c - b)), np.where(x == b, 1.0, 0.0))
    if m_type == 'trapezoid':
        a, b, c, d = params['a'], params['b'], params['c'], params['d']
        mem = np.zeros_like(x, dtype=float)
        mem[(x >= b) & (x <= c)] = 1.0
        mask1 = (x > a) & (x < b)
        mem[mask1] = (x[mask1] - a) / (b - a)
        mask2 = (x > c) & (x < d)
        mem[mask2] = (d - x[mask2]) / (d - c)
        return mem
    if m_type == 'gaussian':
        center, sigma = params['center'], params['sigma']
        return np.exp(-0.5 * ((x - center) / sigma) ** 2)
    return np.zeros_like(x, dtype=float)

def execute_mamdani(data):
    rule_base = data.get('ruleBase', {})
    rules = rule_base.get('rules', [])
    in_vars = rule_base.get('variables', {})
    
    crisp = data.get('inputs', {})
    out_vars = data.get('outputVariables', {})
    config = data.get('config', {})
    
    # 1. Fuzzification & Rule Firing
    batch_inputs = {k: [v] if isinstance(v, (int, float)) else v for k, v in crisp.items()}
    fuz = fuzzify_batch(in_vars, batch_inputs, config)
    rule_evals = evaluate_rules_batch(rules, fuz, config)
    
    resolution = config.get('outputResolution', 1000)
    resolution = min(resolution, 10000) # Hard cap unbounded arrays
    impl_method = config.get('implicationMethod', 'clipping')
    defuzz_method = config.get('defuzzificationMethod', 'centroid')
    
    outputs = {}
    global_status = 'success'
    
    # 2. Implication & Aggregation per Output Variable
    for var_name, out_var in out_vars.items():
        dom = out_var.get('domain', [0, 100])
        x_space = np.linspace(dom[0], dom[1], resolution)
        agg_y = np.zeros(resolution, dtype=float)
        
        implications = []
        for ev in rule_evals:
            strength = ev['firingStrength'][0] # single batch fallback
            if strength <= 0: continue
            
            for cons in ev['consequents']:
                if cons['variable'] != var_name: continue
                
                term_def = out_var['terms'][cons['term']]
                m_type = term_def['membership']['type']
                params = term_def['membership']['params']
                
                base_mu = _eval_membership(x_space, m_type, params)
                
                # Apply hedges
                hedge = cons.get('hedge', 'none')
                if hedge == 'very': base_mu = base_mu ** 2
                if hedge in ['somewhat', 'more-or-less']: base_mu = np.sqrt(base_mu)
                
                # Apply Implication
                if impl_method == 'clipping':
                    impl_mu = np.minimum(strength, base_mu)
                elif impl_method == 'scaling':
                    impl_mu = strength * base_mu
                else:
                    impl_mu = np.minimum(strength, base_mu) # default
                    
                impl_mu = np.clip(impl_mu, 0.0, 1.0)
                    
                # Aggregation
                agg_y = np.maximum(agg_y, impl_mu)
                
                # Build representation map (sampled)
                imp_pts = [{'x': float(x_space[i]), 'y': float(impl_mu[i])} for i in range(0, resolution, max(1, resolution//50))]
                implications.append({
                    'ruleId': ev['ruleId'],
                    'variable': var_name,
                    'term': cons['term'],
                    'points': imp_pts
                })
                
        # 3. Defuzzification
        pts = np.column_stack((x_space, agg_y))
        crisp_val, out_stat = defuzzify_discrete(pts, defuzz_method, 'aggregated_set')
        
        if out_stat != 'success':
            global_status = out_stat
            
        if float(crisp_val) < dom[0] or float(crisp_val) > dom[1]:
            out_stat = 'invalid_domain'
            global_status = 'invalid_domain'
            
        # Sample aggregation mapping
        agg_pts = [{'x': float(x_space[i]), 'y': float(agg_y[i])} for i in range(0, resolution, max(1, resolution//100))]
        
        outputs[var_name] = {
            'variable': var_name,
            'defuzzifiedValue': float(crisp_val),
            'status': out_stat,
            'aggregatedOutput': { 'variable': var_name, 'points': agg_pts },
            'implications': implications
        }
        
    return {
        'outputs': outputs,
        'ruleEvaluations': rule_evals,
        'provider': 'python_numpy',
        'status': global_status,
        'mathematicalExactness': 'numerical',
        'representationAccuracy': 'sampled',
        'verificationStatus': 'verified' if global_status == 'success' else 'failed',
        'visualizationData': { 'outputs': outputs }
    }

