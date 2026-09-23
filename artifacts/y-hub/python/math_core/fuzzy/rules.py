import numpy as np

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

def fuzzify_batch(variables, crisp_inputs, config):
    fuzzified = {}
    for var_name, input_vals in crisp_inputs.items():
        if var_name not in variables: continue
        var_def = variables[var_name]
        dom = var_def.get('domain', [0, 100])
        policy = config.get('domainPolicy', 'reject')
        x_arr = np.array(input_vals, dtype=float)
        
        if policy == 'reject':
            if np.any(x_arr < dom[0]) or np.any(x_arr > dom[1]):
                raise ValueError(f"outside_domain: Variable '{var_name}' value is outside universe {dom}")
                
        x_arr = np.clip(x_arr, dom[0], dom[1])
        
        terms_res = {}
        for term_name, term_def in var_def['terms'].items():
            m_type = term_def['membership']['type']
            params = term_def['membership']['params']
            mem = _eval_membership(x_arr, m_type, params)
            terms_res[term_name] = np.clip(mem, 0.0, 1.0)
        fuzzified[var_name] = terms_res
    return fuzzified

def evaluate_node(node, fuzzified, config):
    node_type = node.get('type')
    if node_type == 'predicate':
        var = node['variable']
        term = node['term']
        hedge = node.get('hedge', 'none')
        mem = fuzzified[var][term]
        if hedge == 'very': 
            return mem ** 2
        if hedge in ['somewhat', 'more-or-less']: 
            # Guaranteed safe since mem is clipped to [0,1]
            return np.sqrt(mem)
        return mem
    
    if node_type == 'AND':
        vals = [evaluate_node(c, fuzzified, config) for c in node['children']]
        if config.get('tNorm') == 'product':
            return np.prod(vals, axis=0)
        return np.minimum.reduce(vals)
        
    if node_type == 'OR':
        vals = [evaluate_node(c, fuzzified, config) for c in node['children']]
        if config.get('tConorm') == 'prob_sum':
            res = vals[0]
            for v in vals[1:]:
                res = res + v - res * v
            return res
        return np.maximum.reduce(vals)
        
    if node_type == 'NOT':
        return 1.0 - evaluate_node(node['children'][0], fuzzified, config)
    
    raise ValueError(f"Unknown node type: {node_type}")

def evaluate_rules_batch(rules, fuzzified, config):
    evals = []
    for rule in rules:
        weight = rule.get('weight', 1.0)
        if weight < 0 or weight > 1:
            raise ValueError(f"Rule weight must be in [0,1], got {weight}")
            
        strength = evaluate_node(rule['antecedent'], fuzzified, config)
        evals.append({
            'ruleId': rule.get('id', 'unknown'),
            'firingStrength': (strength * weight).tolist(),
            'consequents': rule.get('consequents', [])
        })
    return evals


