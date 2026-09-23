import numpy as np
from .numbers import FuzzyInterval, AlphaCut

def interval_add(i1, i2):
    return FuzzyInterval(i1.lower + i2.lower, i1.upper + i2.upper)

def interval_sub(i1, i2):
    return FuzzyInterval(i1.lower - i2.upper, i1.upper - i2.lower)

def interval_mul(i1, i2):
    p1 = i1.lower * i2.lower
    p2 = i1.lower * i2.upper
    p3 = i1.upper * i2.lower
    p4 = i1.upper * i2.upper
    return FuzzyInterval(min(p1, p2, p3, p4), max(p1, p2, p3, p4))

def interval_div(i1, i2):
    if i2.lower <= 0 and i2.upper >= 0:
        raise ValueError('invalid_domain: denominator interval contains zero.')
    return interval_mul(i1, FuzzyInterval(1.0 / i2.upper, 1.0 / i2.lower))

def fuzzy_arithmetic_py(cut1_list, cut2_list, operation):
    c1_l = np.array([c.interval.lower for c in cut1_list])
    c1_u = np.array([c.interval.upper for c in cut1_list])
    c2_l = np.array([c.interval.lower for c in cut2_list])
    c2_u = np.array([c.interval.upper for c in cut2_list])
    alphas = np.array([c.alpha for c in cut1_list])

    if operation == 'add':
        res_l, res_u = c1_l + c2_l, c1_u + c2_u
    elif operation == 'sub':
        res_l, res_u = c1_l - c2_u, c1_u - c2_l
    elif operation == 'mul':
        p1, p2, p3, p4 = c1_l*c2_l, c1_l*c2_u, c1_u*c2_l, c1_u*c2_u
        res_l = np.minimum.reduce([p1, p2, p3, p4])
        res_u = np.maximum.reduce([p1, p2, p3, p4])
    elif operation == 'div':
        if np.any((c2_l <= 0) & (c2_u >= 0)):
            raise ValueError("invalid_domain: denominator interval contains zero")
        p1, p2 = c1_l*(1/c2_u), c1_l*(1/c2_l)
        p3, p4 = c1_u*(1/c2_u), c1_u*(1/c2_l)
        res_l = np.minimum.reduce([p1, p2, p3, p4])
        res_u = np.maximum.reduce([p1, p2, p3, p4])
    else:
        raise ValueError("Unsupported operation")
    
    results = [{'alpha': float(a), 'lower': float(l), 'upper': float(u)} for a, l, u in zip(alphas, res_l, res_u)]
    return results
