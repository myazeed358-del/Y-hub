class FuzzyInterval:
    def __init__(self, lower, upper):
        if lower > upper:
            raise ValueError('Invalid interval: lower bound cannot be greater than upper bound.')
        self.lower = lower
        self.upper = upper

class AlphaCut:
    def __init__(self, alpha, lower, upper, is_strong=False):
        self.alpha = alpha
        self.interval = FuzzyInterval(lower, upper)
        self.is_strong = is_strong

class FuzzyNumber:
    def evaluate(self, x):
        raise NotImplementedError
    def get_alpha_cut(self, alpha):
        raise NotImplementedError

class TriangularFuzzyNumber(FuzzyNumber):
    def __init__(self, a, b, c):
        if a > b or b > c:
            raise ValueError('Invalid TFN: must satisfy a <= b <= c')
        self.a = a
        self.b = b
        self.c = c
        
    def get_alpha_cut(self, alpha):
        if alpha <= 0 or alpha > 1:
            if alpha == 0: return AlphaCut(0, self.a, self.c)
            raise ValueError('Alpha must be in (0, 1]')
        lower = self.a + alpha * (self.b - self.a)
        upper = self.c - alpha * (self.c - self.b)
        return AlphaCut(alpha, lower, upper)
