import type { DeepSection } from './course';

export type EnglishLessonCopy = {
  week: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  summary: string;
  points: string[];
  topics: string[];
  objectives: string[];
  keywords: string[];
  sections: DeepSection[];
};

export const englishLessonCopy: Record<string, EnglishLessonCopy> = {
  introduction: {
    week: 'Week 1',
    eyebrow: 'Theory foundations',
    title: 'Why do we need fuzziness?',
    subtitle: 'Fuzzy systems, the theory, and applications that begin with natural language',
    summary: 'Fuzzy sets are not less rigorous mathematics. They are a mathematical way to represent concepts with flexible boundaries, such as warm, fast, high, or near.',
    points: [
      'A fuzzy system translates human descriptions into membership grades and computable rules.',
      'Fuzziness is different from randomness: it describes vague concepts, not uncertainty about an event.',
      'Applications include industrial control, medicine, robotics, classification, and decision support.',
    ],
    topics: ['Fuzzy systems', 'Fuzzy theory', 'Fuzzy theory and application'],
    objectives: [
      'Distinguish linguistic vagueness from probability and uncertainty.',
      'Describe the components of a fuzzy system and the role of each one.',
      'Connect the theory to a simple control example.',
    ],
    keywords: ['Vagueness', 'Fuzzy system', 'Linguistic variable', 'Rule'],
    sections: [
      {
        title: 'The real world is not always binary',
        paragraphs: [
          'Classical logic asks whether an element belongs to a set or not. This is excellent when boundaries are clear, such as the set of even integers. It becomes rigid when we describe human concepts: is 24 degrees warm, or is it not?',
          'A fuzzy system does not remove decisions; it represents them with more detail. Instead of forcing 24 to be fully warm or not warm, it can have membership 0.8 in Warm and 0.3 in Hot.',
          'Membership is not probability. A value of 0.8 says that the input agrees with the meaning of Warm to degree 0.8 according to our model.',
        ],
        formula: 'μA : X → [0, 1]',
        bullets: ['X is the universe of possible values.', 'A is the fuzzy concept being studied.', 'μA(x) is the membership grade of x in A.'],
      },
      {
        title: 'The architecture of a fuzzy system',
        paragraphs: [
          'A fuzzy system usually contains four connected parts. The fuzzifier converts a numerical input into membership grades. The rule base stores expert knowledge as If–Then rules. The inference engine combines active rules, and the defuzzifier converts the fuzzy output into a numerical action.',
        ],
        bullets: ['Fuzzifier: converts measurements into fuzzy descriptions.', 'Rule base: stores If–Then expert knowledge.', 'Inference engine: computes and aggregates rule outputs.', 'Defuzzifier: extracts one actionable numerical value.'],
        example: {
          title: 'Example: controlling a room fan',
          steps: ['Input: temperature = 28°, with μWarm(28)=0.6 and μHot(28)=0.5.', 'Rule 1: If temperature is warm, then fan speed is medium.', 'Rule 2: If temperature is hot, then fan speed is high.', 'The engine activates both rules and combines their outputs.'],
          result: 'The output is first a fuzzy set over fan speeds, then it can become a value such as 72%.',
        },
      },
      {
        title: 'Where are fuzzy systems used?',
        paragraphs: [
          'Fuzzy theory is useful when experts can explain decisions in words but a precise equation is difficult to write. It appears in braking systems, washing machines, air conditioning, medical diagnosis, ranking, and risk assessment.',
          'Its strength is not replacing mathematics; it combines a flexible mathematical model with human knowledge that can be inspected, discussed, and adjusted.',
        ],
        bullets: ['Control: continuous decisions from continuous inputs.', 'Classification: graded membership in multiple classes.', 'Decision support: combining criteria such as cost, quality, and speed.'],
      },
    ],
  },
  'fuzzy-vs-classical': {
    week: 'Weeks 2–3',
    eyebrow: 'Sets and basic operations',
    title: 'From classical sets to fuzzy sets',
    subtitle: 'The formal definition of a fuzzy set, support, core, height, and primary operations',
    summary: 'A fuzzy set generalizes a classical set: an element carries a membership grade that describes the strength of its belonging.',
    points: [
      'A classical set is a special fuzzy set where every membership is 0 or 1.',
      'A fuzzy set can be represented as ordered pairs or as a membership function.',
      'Support, core, height, and α-cuts are essential tools for reading a fuzzy set.',
    ],
    topics: ['Fuzzy sets and basic operations', 'From classical sets to fuzzy sets', 'Basic concepts'],
    objectives: [
      'Write a fuzzy set using ordered pairs and a function.',
      'Compute its support, core, height, and level set.',
      'Interpret partial membership without confusing it with probability.',
    ],
    keywords: ['Support', 'Core', 'Height', 'Level set', 'Representation'],
    sections: [
      {
        title: 'The mathematical definition',
        paragraphs: [
          'For a universe X, a fuzzy set A is described by a membership function μA that assigns every x in X a value in [0,1]. With a finite universe, it is often written as a collection of ordered pairs; the summation notation is a compact way to collect pairs, not an instruction to add membership values.',
          'For continuous domains, integral notation is also a collection notation. The essential object is always the function μA(x), together with its domain and interpretation.',
        ],
        formula: 'A = { (x, μA(x)) | x ∈ X },  0 ≤ μA(x) ≤ 1',
        example: {
          title: 'Students with high achievement',
          steps: ['X={Ahmed, Bassam, Joud, Layan}.', 'μA(Ahmed)=0.9, μA(Bassam)=0.4, μA(Joud)=1, μA(Layan)=0.2.', 'Joud belongs to the core, while Bassam belongs partially.'],
          result: 'The set records degrees of agreement with the meaning of High Achievement rather than a yes/no label.',
        },
      },
      {
        title: 'Support, core, and height',
        paragraphs: [
          'The support contains all elements with membership greater than zero. The core contains elements with full membership, equal to one. The height is the largest membership value reached by the function; a height of one makes the fuzzy set normal.',
          'These notions separate the existence of membership from its strength. A set may have broad support but a small core, meaning that many values fit the concept partially while few fit it completely.',
        ],
        formula: 'supp(A) = {x | μA(x) > 0}  ,  core(A) = {x | μA(x) = 1}  ,  h(A)=sup μA(x)',
        bullets: ['The empty fuzzy set has μA(x)=0 everywhere.', 'The universal fuzzy set has μA(x)=1 everywhere.', 'The α-cut Aα contains all x for which μA(x)≥α.'],
      },
      {
        title: 'Binary logic is a special case',
        paragraphs: [
          'A classical indicator function has only two values: one inside the set and zero outside it. Restricting μA to 0 and 1 gives the familiar classical set operations inside the broader fuzzy framework.',
          'The generalization does not discard old logic; it expands the range of possible descriptions and preserves the classical case as a special situation.',
        ],
        formula: 'χA(x) = 1 if x∈A, and χA(x)=0 if x∉A',
      },
    ],
  },
  'membership-grade': {
    week: 'Week 3',
    eyebrow: 'Membership functions',
    title: 'Membership grade μ(x)',
    subtitle: 'How to turn an intuition into a number and design a meaningful function',
    summary: 'The membership function is the heart of a fuzzy model. Choosing it is a modeling decision that determines how the system understands a concept.',
    points: [
      'A membership function should reflect domain knowledge or data, not be chosen randomly.',
      'Triangular, trapezoidal, and Gaussian shapes fit different meanings.',
      'Sensitivity analysis shows how parameter changes affect the final decision.',
    ],
    topics: ['Membership function design', 'Basic concepts associated with fuzzy sets', 'Interpretation of μ(x)'],
    objectives: [
      'Compute membership from a piecewise function.',
      'Choose a suitable shape for a concept.',
      'Distinguish membership from probability and physical measurement.',
    ],
    keywords: ['Membership function', 'Partial membership', 'Parameters', 'Normalization'],
    sections: [
      {
        title: 'What does μ(x) measure?',
        paragraphs: [
          'The value μA(x) measures how well x agrees with the meaning of A according to our definition. There is not always one universal value: the meaning of Warm changes with climate, season, and purpose.',
          'Membership is semantic agreement, not the probability that an event will happen. A single value can have high membership in several concepts, such as 24° being both Warm and Comfortable.',
        ],
        formula: 'μA(x) ∈ [0,1]; 0 = no agreement, 1 = full agreement, intermediate values = partial agreement',
      },
      {
        title: 'Triangular and trapezoidal membership',
        paragraphs: [
          'A triangular function rises linearly from a to the peak b, then falls linearly to zero at c. It is useful when a concept has a clear central value. A trapezoidal function adds a plateau of full membership between b and c, which suits a whole acceptable range.',
        ],
        formula: 'μtriangle(x;a,b,c) = max(min((x−a)/(b−a), (c−x)/(c−b)), 0)',
        example: {
          title: 'Membership of 70 in Medium Speed',
          steps: ['Let a=40, b=60, c=80.', 'Since 60≤70≤80, use the descending branch: (80−70)/(80−60).', 'The result is 10/20 = 0.5.'],
          result: 'The speed 70 belongs to Medium with grade 0.5; this does not mean a 50% probability.',
        },
      },
      {
        title: 'Gaussian functions and data-driven design',
        paragraphs: [
          'A Gaussian function is smooth and symmetric around c. The spread σ controls how quickly membership decreases. A larger σ creates a broader concept; a smaller σ creates a more selective one.',
          'In serious applications, parameters can come from experts or labeled data and should be reviewed with sensitivity tests. The best function is the one that produces interpretable and stable behavior.',
        ],
        formula: 'μgaussian(x;c,σ) = exp(−(1/2)((x−c)/σ)²),  σ>0',
      },
    ],
  },
  'membership-functions': {
    week: 'Week 4',
    eyebrow: 'Membership shapes',
    title: 'Triangular, trapezoidal, and Gaussian functions',
    subtitle: 'Compare models and choose the function that serves the meaning',
    summary: 'The geometry of a membership function expresses an assumption about a concept: a clear peak, an acceptable interval, or a smooth transition.',
    points: [
      'Every function has parameters and constraints that must be respected.',
      'A comparison should consider meaning, stability, and computational cost.',
      'The laboratory makes parameter effects visible instead of leaving them as formulas.',
    ],
    topics: ['Triangular functions', 'Trapezoidal functions', 'Gaussian functions'],
    objectives: ['Read a,b,c,d,c,σ from a graph.', 'Choose a model for an applied situation.', 'Explain how center and width affect inference.'],
    keywords: ['Triangular', 'Trapezoidal', 'Gaussian', 'Symmetry', 'Smoothness'],
    sections: [
      {
        title: 'How to choose a shape',
        paragraphs: [
          'Ask a semantic question first: is there a whole range of values that should be fully acceptable? If yes, a trapezoid is natural. Is there one center and does agreement decrease smoothly away from it? Use a Gaussian. Do you need a simple model that is easy to explain and compute? A triangle is often enough.',
          'Also check continuity, interpretability, cost, and sensitivity. Linear functions are attractive in fast controllers; smooth functions may be preferable when learning from noisy data.',
        ],
        bullets: ['Triangle: few parameters and fast computation.', 'Trapezoid: a full-membership plateau and clear transitions.', 'Gaussian: smooth behavior without sharp corners.'],
      },
      {
        title: 'Parameter constraints',
        paragraphs: [
          'A triangular function requires a<b<c, while a trapezoid requires a<b≤c<d. Violating these constraints can create invalid shapes or division by zero. A robust laboratory therefore links slider limits instead of treating every parameter as independent.',
          'Parameters have semantic roles: a and d define support, b and c define the plateau or peak region, while c and σ define the center and spread of a Gaussian.',
        ],
        formula: 'triangle: a < b < c  ;  trapezoid: a < b ≤ c < d  ;  Gaussian: σ > 0',
      },
      {
        title: 'Testing a model',
        paragraphs: [
          'For a concept such as traffic congestion, test empty, moderate, and near-gridlock situations. Ask whether the resulting grades make sense, then check whether a small input change causes a small decision change.',
          'This connects theory with engineering: a good model behaves sensibly on new nearby values, not only on the examples used to define it.',
        ],
      },
    ],
  },
  'fuzzy-operations': {
    week: 'Week 5',
    eyebrow: 'Fuzzy operations',
    title: 'Complement and s-norms: representing “or”',
    subtitle: 'From standard complement to families of fuzzy union operators',
    summary: 'Fuzzy operations generalize intersection, union, and complement, but the chosen operator affects the sharpness and behavior of the system.',
    points: ['The standard complement reflects membership around 0.5 using 1−μ.', 'An s-norm is a family of union operators with structural properties.', 'Max is the most common Zadeh union, but it is not the only option.'],
    topics: ['Fuzzy complement', 'Fuzzy union', 's-norms'],
    objectives: ['Compute complement and union for several grades.', 'State and check s-norm properties.', 'Compare max with probabilistic and bounded sums.'],
    keywords: ['Complement', 's-norm', 'Zadeh union', 'Commutativity', 'Associativity'],
    sections: [
      {
        title: 'Fuzzy complement',
        paragraphs: ['The complement means “not A.” In the standard Zadeh form, membership is subtracted from one. If a value is Warm to 0.7, its membership in Not Warm is 0.3. This preserves the classical result for grades 0 and 1.'],
        formula: 'μAc(x) = 1 − μA(x)',
        example: {
          title: 'Complement of Hot Weather',
          steps: ['μHot(28)=0.8 and μHot(20)=0.2.', 'μNot-Hot(28)=1−0.8=0.2.', 'μNot-Hot(20)=1−0.2=0.8.'],
          result: 'Not Hot is not automatically the same as Cold; that equivalence requires an explicit model.',
        },
      },
      {
        title: 'Union and s-norms',
        paragraphs: ['An s-norm generalizes union. It should be commutative, associative, monotone, and satisfy S(a,0)=a. The common choice is max, which selects the larger membership in the two concepts.', 'Other operators provide smoother aggregation. The probabilistic sum is a+b−ab, while the bounded sum is min(1,a+b). The meaning of “or” determines the choice.'],
        formula: 'max(a,b)  ;  probabilistic sum = a+b−ab  ;  bounded sum = min(1,a+b)',
      },
      {
        title: 'Properties worth understanding',
        paragraphs: ['Commutativity means the order of concepts does not matter. Associativity matters when combining several sets. Monotonicity means raising an input cannot lower the result. These properties make the system predictable and easier to simplify.'],
        bullets: ['S(0,0)=0 and S(1,a)=1 for standard s-norms.', 'Every s-norm is non-decreasing in each input.', 'There is no single correct s-norm for every application.'],
      },
    ],
  },
  't-norms': {
    week: 'Week 6',
    eyebrow: 'Intersection and averaging',
    title: 't-norms and average operators',
    subtitle: 'Representing “and” and balancing strict versus compensatory conditions',
    summary: 'A t-norm generalizes fuzzy intersection, while averaging operators express balance when criteria can compensate for one another.',
    points: ['Min is the standard t-norm and lets the weakest condition control the result.', 'Algebraic product applies a cumulative penalty to partial conditions.', 'Arithmetic and weighted averages are useful when criteria are compensatory.'],
    topics: ['Fuzzy intersection t-norms', 'Average operators', 'Conjunctive aggregation'],
    objectives: ['Verify t-norm properties.', 'Compare min, algebraic product, and Lukasiewicz.', 'Choose an aggregation operator that matches the meaning of a problem.'],
    keywords: ['t-norm', 'Intersection', 'Algebraic product', 'Lukasiewicz', 'Average'],
    sections: [
      {
        title: 'The standard intersection',
        paragraphs: ['In a classical intersection, both conditions must hold. The simplest fuzzy generalization is min(a,b): a condition with grade 0.3 and another with grade 0.9 produce 0.3 for “and.” This is a bottleneck interpretation.'],
        formula: 'μA∩B(x) = T(μA(x), μB(x)), with T(a,b)=min(a,b)',
        example: {
          title: 'A scholarship based on grade and attendance',
          steps: ['Grade membership = 0.85 and attendance membership = 0.60.', 'With min, the grade of “high grade and high attendance” is 0.60.', 'Attendance becomes the bottleneck condition.'],
          result: 'This is appropriate when a low value in either condition should limit eligibility.',
        },
      },
      {
        title: 'Families of t-norms',
        paragraphs: ['The algebraic product gives 0.85×0.60=0.51, lower than min because both values contribute. Lukasiewicz gives max(0,0.85+0.60−1)=0.45. These are different semantic models, not calculation mistakes.'],
        formula: 'Tmin(a,b)=min(a,b)  ;  Tproduct(a,b)=ab  ;  TL(a,b)=max(0,a+b−1)',
        bullets: ['Min suits a weakest-condition interpretation.', 'Product suits cumulative effects.', 'Lukasiewicz allows compensation up to a threshold, then reaches zero.'],
      },
      {
        title: 'When should we average?',
        paragraphs: ['An average is not necessarily a t-norm because it can be higher than the smallest input. Use it when criteria can compensate: low speed may be balanced by low price or high quality. A weighted average expresses different importance levels.'],
        formula: 'Aweighted = w1a1 + w2a2 + … + wnan, with wi≥0 and Σwi=1',
      },
    ],
  },
  'fuzzy-relations': {
    week: 'Week 7',
    eyebrow: 'Fuzzy relations',
    title: 'Relations, projections, and cylindrical extensions',
    subtitle: 'Representing a graded relationship between two or more domains',
    summary: 'A fuzzy relation describes the degree of association between pairs or tuples from different domains, not just the membership of one element.',
    points: ['A binary fuzzy relation is a fuzzy set on the Cartesian product X×Y.', 'It can be represented as a matrix, where projection extracts the strongest available association.', 'Cylindrical extension lifts a relation to a larger domain while preserving membership.'],
    topics: ['Fuzzy relations', 'Projections', 'Cylindrical extensions'],
    objectives: ['Build and read a fuzzy relation matrix.', 'Compute a projection onto one domain.', 'Explain the role of cylindrical extension.'],
    keywords: ['Relation', 'Cartesian product', 'Projection', 'Cylindrical extension'],
    sections: [
      {
        title: 'Definition of a fuzzy relation',
        paragraphs: ['If X is a set of students and Y is a set of courses, a relation R on X×Y can describe how suitable each student is for each course. The pair (x,y) receives a grade between 0 and 1.', 'For finite domains, the relation is a matrix: rows are elements of X and columns are elements of Y. A cell answers: to what degree is the row element related to the column element?'],
        formula: 'R : X×Y → [0,1], and μR(x,y) = degree of relation',
        example: {
          title: 'Student–course suitability',
          steps: ['μR(Sara, Analysis)=0.9 and μR(Sara, Logic)=0.6.', 'A larger value means stronger suitability under the chosen criteria.', 'The relation is evidence for a later recommendation, not a final decision.'],
          result: 'The relation can support course recommendations or compute the strongest path for each student.',
        },
      },
      {
        title: 'Projections',
        paragraphs: ['A projection onto X asks for each x how strongly it relates to any element of Y. The standard fuzzy projection uses max over the forgotten dimension because it asks for the strongest available connection.'],
        formula: 'μprojX(R)(x) = maxy∈Y μR(x,y)  ;  μprojY(R)(y)=maxx∈X μR(x,y)',
        bullets: ['Projection removes one dimension of a relation.', 'Max answers: is there a strong relationship with anything?', 'Other t-norms can be used when the question adds constraints.'],
      },
      {
        title: 'Cylindrical extension',
        paragraphs: ['If A is a fuzzy set on X and we lift it to X×Y, the cylindrical extension assigns every pair (x,y) the same grade μA(x), regardless of y. The new dimension is added without changing the original meaning.'],
        formula: 'μA↑(x,y) = μA(x)',
      },
    ],
  },
  'relation-composition': {
    week: 'Week 8',
    eyebrow: 'Relation composition',
    title: 'Composition of fuzzy relations',
    subtitle: 'From a relation X–Y and a relation Y–Z to a relation X–Z',
    summary: 'Composition transfers influence through an intermediate variable and is the mechanism that turns fuzzy relations into chains of inference.',
    points: ['Max–min composition searches for the strongest path while limiting it by its weakest link.', 'Max–product composition uses multiplication instead of min.', 'The choice controls how grades propagate through a network.'],
    topics: ['Composition of fuzzy relations', 'Max–min composition', 'Max–product composition'],
    objectives: ['Compute a composition using small matrices.', 'Explain the role of the intermediate variable.', 'Compare max–min and max–product.'],
    keywords: ['Composition', 'Max–min', 'Max–product', 'Intermediate variable'],
    sections: [
      {
        title: 'The idea before the formula',
        paragraphs: ['Suppose R relates temperature to fan speed, and S relates fan speed to energy use. We want a direct relation between temperature and energy. For every intermediate speed y, compute the path strength, then keep the strongest available path.', 'This resembles matrix multiplication, but ordinary addition and multiplication are replaced with fuzzy aggregation operators.'],
        formula: 'μ(R∘S)(x,z) = supy∈Y T(μR(x,y), μS(y,z))',
        example: {
          title: 'One cell with max–min composition',
          steps: ['The path through y1 gives min(0.8,0.6)=0.6.', 'The path through y2 gives min(0.5,0.9)=0.5.', 'Take max(0.6,0.5).'],
          result: 'The direct relation grade is 0.6: the strongest path is still limited by its weakest link.',
        },
      },
      {
        title: 'Max–min versus max–product',
        paragraphs: ['Max–min treats a path as strong as its weakest edge, so it is relatively tolerant. Max–product multiplies all grades and penalizes a chain of partial relationships more strongly.'],
        formula: 'Max–min: maxy min(Rxy,Syz)  ;  Max–product: maxy (Rxy×Syz)',
      },
      {
        title: 'Composition and inference',
        paragraphs: ['The compositional rule of inference treats an If X is A Then Y is B rule as a fuzzy relation and composes it with an observed input A′ to obtain an inferred output B′.'],
      },
    ],
  },
  'extension-principle': {
    week: 'Week 9',
    eyebrow: 'Extension principle',
    title: 'The extension principle',
    subtitle: 'Moving a fuzzy set through an ordinary mathematical function',
    summary: 'The extension principle applies a crisp function to a fuzzy input and keeps the highest membership among values that produce the same output.',
    points: ['A function y=f(x) transfers membership from X to Y.', 'When several inputs produce the same y, use sup or max of their memberships.', 'The principle connects classical computation with fuzzy quantities.'],
    topics: ['The extension principle', 'Fuzzy arithmetic', 'Image of a fuzzy set'],
    objectives: ['Apply the extension principle on a discrete domain.', 'Compute the image of a fuzzy set under a simple function.', 'Understand why max is used for multiple preimages.'],
    keywords: ['Extension principle', 'Image', 'Preimage', 'Supremum'],
    sections: [
      {
        title: 'Why do we need it?',
        paragraphs: ['In crisp mathematics, knowing x and f gives y directly. If x is fuzzy, every possible x has a membership grade. We need a rule that transfers those grades to the output without losing the structure of the input.', 'The extension principle assigns y the highest grade among all x values satisfying f(x)=y. A non-injective function may have several preimages, so aggregation is essential.'],
        formula: 'μB(y) = sup{x∈X | f(x)=y} μA(x)',
        example: {
          title: 'A quadratic function on a discrete domain',
          steps: ['A is defined on X={−2,−1,0,1,2} with grades {0.4,0.7,0.2,0.6,0.9}.', 'For y=1, the preimages are −1 and 1.', 'μB(1)=max(0.7,0.6)=0.7.'],
          result: 'The output at 1 keeps the strongest grade among all inputs that map to it.',
        },
      },
      {
        title: 'Extension to arithmetic',
        paragraphs: ['The principle can be applied to addition, subtraction, and multiplication of fuzzy sets. For A+B, enumerate pairs, compute y=x1+x2, assign a t-norm to the pair, and use max when several pairs produce the same y.'],
        formula: 'μA+B(y)=supx1+x2=y T(μA(x1), μB(x2))',
        bullets: ['The operation may generate many values and then merge duplicates.', 'The t-norm controls the strength of each pair.', 'Continuous and large domains require efficient numerical methods.'],
      },
      {
        title: 'Connection with α-cuts',
        paragraphs: ['A practical approach is to represent a fuzzy set through a family of α-cuts, apply interval operations at each level, and reconstruct the result. This links the extension principle to interval arithmetic and numerical analysis.'],
      },
    ],
  },
  'linguistic-variables': {
    week: 'Week 10',
    eyebrow: 'Linguistic variables',
    title: 'When numbers become language',
    subtitle: 'From a numerical variable to linguistic terms and fuzzy meanings',
    summary: 'A linguistic variable makes words such as low, medium, and high part of a mathematical model rather than informal descriptions.',
    points: ['A linguistic variable has a name, universe, linguistic terms, and semantic rules.', 'Every linguistic term is a fuzzy set over the numerical universe.', 'Overlap between neighboring terms is essential for smooth transitions.'],
    topics: ['Linguistic variables', 'From numerical to linguistic variables', 'Semantic rules'],
    objectives: ['Define a complete linguistic variable.', 'Convert a numerical reading into several linguistic grades.', 'Explain why linguistic sets overlap.'],
    keywords: ['Linguistic variable', 'Linguistic term', 'Semantics', 'Overlap'],
    sections: [
      {
        title: 'Definition of a linguistic variable',
        paragraphs: ['A linguistic variable has words or sentences as values, while its meaning is represented by fuzzy sets. For example, Temperature can range over [0,50] and use Cold, Mild, Warm, and Hot as linguistic terms.', 'A word does not replace a number; it is associated with a function over the numerical universe. One temperature can therefore be Warm to 0.7 and Hot to 0.2.'],
        formula: 'linguistic variable = (name, term set, universe, syntactic rule, semantic rule)',
        example: {
          title: 'The linguistic variable Car Speed',
          steps: ['Universe X=[0,120] km/h.', 'Terms: Slow, Medium, Fast.', 'At x=70: μSlow=0, μMedium=0.5, μFast=0.4.'],
          result: 'The complete description of 70 is a vector of compatible grades, not one forced label.',
        },
      },
      {
        title: 'From a number to language',
        paragraphs: ['Conversion does not round a value to the nearest word. It evaluates all relevant membership functions. The resulting grades can then activate rules or rank linguistic descriptions.', 'Good overlap prevents a label from changing abruptly when the input moves by one small unit.'],
        bullets: ['Define the universe and units before drawing functions.', 'Neighboring terms should cover the domain without accidental gaps.', 'Overlap represents a gradual change of meaning, not a modeling error.'],
      },
      {
        title: 'Semantic design',
        paragraphs: ['Every word needs an interpretation that can be explained. High Pressure in a medical system is not necessarily the same curve as High Pressure in an industrial system. The domain and purpose must guide the membership functions.'],
      },
    ],
  },
  'linguistic-hedges': {
    week: 'Week 11',
    eyebrow: 'Language and fuzzy logic',
    title: 'Linguistic hedges and If–Then rules',
    subtitle: 'Very, more or less, fuzzy propositions, and interpretable rules',
    summary: 'A linguistic hedge changes the meaning of a fuzzy set without building a new model from scratch, while a rule turns expert language into computation.',
    points: ['Very often squares membership to strengthen a concept.', 'More or less can use a root or an exponent below one to broaden a concept.', 'A fuzzy rule needs a clear antecedent, consequent, and aggregation operators.'],
    topics: ['Linguistic hedges', 'Fuzzy IF–THEN rules', 'Fuzzy propositions'],
    objectives: ['Derive Very A and More-or-less A.', 'Write a fuzzy proposition and If–Then rule.', 'Compute a rule firing strength from several premises.'],
    keywords: ['Linguistic hedge', 'Very', 'More or less', 'Proposition', 'Rule'],
    sections: [
      {
        title: 'Linguistic hedges',
        paragraphs: ['If A means Tall Person, Very A means Very Tall. A common representation raises membership to a power greater than one, often a square, which emphasizes high grades and reduces partial ones.', 'More or less A broadens the concept and can be represented with a square root or an exponent below one. These are modeling conventions, not universal laws, so the context should be documented.'],
        formula: 'μvery A(x) = μA(x)²  ;  μmore-or-less A(x) = √μA(x)',
        example: {
          title: 'Adjusting the meaning of Fast',
          steps: ['If μFast(80)=0.7, then μVery-Fast(80)=0.49.', 'μMore-or-less-Fast(80)=√0.7≈0.84.', 'The domain stays the same while the meaning changes.'],
          result: 'Hedges create expressive layers that can still be processed mathematically.',
        },
      },
      {
        title: 'Propositions and rules',
        paragraphs: ['A fuzzy proposition is a sentence such as “Temperature is High” whose truth is graded. An If temperature is high Then fan is fast rule connects a fuzzy input set to a fuzzy output set. For several premises, use a t-norm; for alternatives, use an s-norm.'],
        formula: 'IF x is A AND y is B THEN z is C',
        bullets: ['Antecedent: describes the input condition.', 'Consequent: describes the output action.', 'Rule firing strength: the grade of the antecedent.'],
      },
      {
        title: 'Designing useful rules',
        paragraphs: ['A useful rule covers a meaningful situation and does not conflict with another rule without a reason. Document the terms, units, aggregation method, and expected output. More rules do not automatically mean a better system.'],
      },
    ],
  },
  'fuzzy-logic-inference': {
    week: 'Week 12',
    eyebrow: 'Fuzzy inference',
    title: 'From classical logic to compositional inference',
    subtitle: 'Fuzzy implication, Modus Ponens, and properties of implication rules',
    summary: 'Fuzzy inference generalizes “if the condition holds, infer the conclusion” to partial grades and different implication operators.',
    points: ['A fuzzy rule can be represented as a relation between an antecedent domain and a consequent domain.', 'The compositional rule applies the relation to an observed input.', 'The implication operator determines how the rule is represented.'],
    topics: ['Classical logic to fuzzy logic', 'Compositional rule of inference', 'Implication properties'],
    objectives: ['Compare classical and fuzzy Modus Ponens.', 'Build a simple rule relation.', 'Explain boundary and monotonicity properties of implication.'],
    keywords: ['Inference', 'Implication', 'Modus Ponens', 'Rule relation'],
    sections: [
      {
        title: 'From Modus Ponens to fuzzy inference',
        paragraphs: ['In classical logic, if p implies q and p is true, infer q. In fuzzy logic, the observation A′ may agree with the rule antecedent A only partially.', 'Represent the rule as a relation R(x,y), then compose it with A′ to obtain B′. Information flows from the input domain to the output through the rule relation.'],
        formula: 'B′ = A′ ∘ R  ,  μB′(y)=supx T(μA′(x), μR(x,y))',
      },
      {
        title: 'Building the rule relation',
        paragraphs: ['A common construction is R(x,y)=min(μA(x), μB(y)), known as a Mamdani-style relation. Other choices include product and several implication families. The operator must be specified because it changes the output shape.'],
        formula: 'R(x,y)=T(μA(x), μB(y)) in the general Mamdani construction',
        example: {
          title: 'Temperature–fan rule',
          steps: ['Rule: If temperature is high, then fan speed is high.', 'The current temperature satisfies High with α=0.6.', 'In Mamdani inference, the High output curve is clipped at 0.6.'],
          result: 'The fuzzy fan output is ready for aggregation and defuzzification.',
        },
      },
      {
        title: 'Properties of implication',
        paragraphs: ['Implication should have sensible boundary behavior: it should respond strongly when the antecedent is weak or the consequent is strong, and it should preserve the required monotonicity. Mamdani, Larsen, Gödel, and Łukasiewicz represent different modeling choices.'],
        bullets: ['Mamdani uses min to clip the consequent.', 'Larsen uses product to scale the consequent.', 'Implication is part of the model definition, not an implementation detail.'],
      },
    ],
  },
  'fuzzy-rule-base': {
    week: 'Week 13',
    eyebrow: 'Rule base',
    title: 'Structure and properties of a fuzzy rule base',
    subtitle: 'Coverage, consistency, overlap, and reading the system as a whole',
    summary: 'A system is not judged by one good rule; it is judged by coverage, consistency, and stable behavior across the full input domain.',
    points: ['A rule base maps important combinations of linguistic conditions to outputs.', 'Coverage, consistency, and non-redundancy are essential review properties.', 'Rules can be represented as a table or a multidimensional grid.'],
    topics: ['Fuzzy systems and properties', 'Structure of fuzzy rule base', 'Properties of rule sets'],
    objectives: ['Design a rule table for two fuzzy inputs.', 'Check coverage and conflicts.', 'Explain how overlapping sets support smooth behavior.'],
    keywords: ['Rule base', 'Coverage', 'Consistency', 'Conflict', 'Independence'],
    sections: [
      {
        title: 'Building the rule base',
        paragraphs: ['Suppose we have Temperature {Low, Medium, High} and Humidity {Dry, Normal, Wet}. A 3×3 table maps each combination to a fan speed. The table exposes combinations for which no decision has been specified.', 'Not every combination must exist if it is impossible or intentionally grouped, but missing regions should be understood rather than accidental.'],
        formula: 'Number of possible combinations = ∏i number of linguistic terms for input i',
        example: {
          title: 'Two-input activation',
          steps: ['Temperature is High with grade 0.7 and Humidity is Wet with grade 0.8.', 'The corresponding rule fires with min(0.7,0.8)=0.7 in Mamdani inference.', 'Another rule may fire at 0.4 and contribute a different output set.'],
          result: 'The final decision is usually the overlay of several active rules.',
        },
      },
      {
        title: 'Properties of a rule set',
        paragraphs: ['Coverage means every important input region activates at least one rule. Consistency means rules do not produce unexplained contradictions. Continuity means small input changes do not cause arbitrary output jumps.'],
        bullets: ['Completeness: no unintended inference gaps.', 'Consistency: no unexplained conflicts.', 'Non-redundancy: no repeated rule without added value.', 'Monotonicity: directional input changes produce sensible output changes.'],
      },
      {
        title: 'Review and testing',
        paragraphs: ['Test typical and boundary inputs, then inspect regions where linguistic sets overlap. Plot a decision surface for two inputs or log each firing strength. This transparency is a major advantage of fuzzy systems.'],
      },
    ],
  },
  'inference-engine': {
    week: 'Week 14',
    eyebrow: 'Inference engine',
    title: 'Composition-based and individual-rule inference',
    subtitle: 'Turning rules and inputs into one fuzzy output set',
    summary: 'The inference engine executes the knowledge: fuzzify inputs, fire rules, aggregate outputs, and prepare the result for defuzzification.',
    points: ['Composition-based inference builds a relation and composes it with the observation.', 'Individual-rule inference computes every firing strength and aggregates the rule outputs directly.', 'Mamdani and Larsen are common patterns that differ in how they modify a consequent.'],
    topics: ['Fuzzy inference engine', 'Composition-based inference', 'Individual-rule-based inference'],
    objectives: ['Trace the inference cycle from input to output.', 'Compare composition-based and rule-by-rule inference.', 'Work through two rules with one output.'],
    keywords: ['Inference engine', 'Mamdani', 'Larsen', 'Aggregation', 'Firing strength'],
    sections: [
      {
        title: 'The complete inference cycle',
        paragraphs: ['Numerical readings are first evaluated in every relevant linguistic set. The engine calculates the firing strength of each rule, modifies each consequent, and aggregates all consequents into one fuzzy output before defuzzification.'],
        bullets: ['Fuzzification: calculate membership grades.', 'Rule evaluation: calculate firing strengths.', 'Implication: modify each output set.', 'Aggregation: merge rule outputs.', 'Defuzzification: produce one number.'],
      },
      {
        title: 'Individual-rule inference',
        paragraphs: ['In the rule-by-rule form, each rule is treated independently. If its firing strength is α, Mamdani clips its consequent at α, while Larsen scales the consequent by α. A max operator commonly aggregates the resulting sets.'],
        formula: 'Mamdani: μB′(y)=maxrules min(αr, μBr(y))',
        example: {
          title: 'Two fan rules',
          steps: ['Warm temperature → Medium speed fires at 0.4.', 'Hot temperature → High speed fires at 0.7.', 'Clip Medium at 0.4 and High at 0.7, then take pointwise max.'],
          result: 'The resulting curve uses the strongest recommendation at every output speed.',
        },
      },
      {
        title: 'Composition versus individual rules',
        paragraphs: ['Composition-based inference is elegant because it turns a rule into a relation and applies fuzzy composition. Individual-rule inference is easier to implement and explain because each rule contribution is visible. Logging α values helps debugging and interpretation.'],
      },
    ],
  },
  'fuzzifiers-defuzzifiers': {
    week: 'Week 15',
    eyebrow: 'From fuzzy to actionable',
    title: 'Fuzzifiers and defuzzifiers',
    subtitle: 'Input representation, output decisions, and defuzzification methods',
    summary: 'The numerical interface matters as much as the rules: a fuzzifier translates measurements, and a defuzzifier translates the fuzzy decision into one action.',
    points: ['A fuzzifier calculates grades rather than selecting a single linguistic label.', 'Center of gravity uses the whole output shape as a weighted distribution.', 'Center average and maximum methods are simpler but may discard information.'],
    topics: ['Inference engines', 'Fuzzifiers', 'Defuzzifiers', 'Center of gravity', 'Center average', 'Maximum defuzzifier'],
    objectives: ['Distinguish fuzzification from defuzzification.', 'Compute center of gravity for a discrete output.', 'Compare center average with maximum methods.'],
    keywords: ['Fuzzifier', 'Defuzzifier', 'Center of gravity', 'Center average', 'Maximum'],
    sections: [
      {
        title: 'Fuzzifier types',
        paragraphs: ['Most systems use a singleton fuzzifier: take measurement x and evaluate it in each membership function. A Gaussian fuzzifier can represent noisy measurements, while a triangular fuzzifier can represent an input interval rather than one exact point.', 'Singleton fuzzification is fast and clear but assumes a precise measurement. Representing sensor uncertainty as a fuzzy region can be more robust.'],
        formula: 'x0 → { (A1, μA1(x0)), (A2, μA2(x0)), … }',
      },
      {
        title: 'Center of gravity',
        paragraphs: ['After rule aggregation, the system has a fuzzy output B. Center of gravity divides the weighted sum of output values by the sum of memberships. In a continuous domain, sums become integrals.'],
        formula: 'y* = Σ yi μB(yi) / Σ μB(yi)  , or  y* = ∫y μB(y)dy / ∫μB(y)dy',
        example: {
          title: 'Discrete calculation',
          steps: ['Speeds are 20, 50, 80 with grades 0.2, 0.6, 0.4.', 'Numerator = 20×0.2 + 50×0.6 + 80×0.4 = 62.', 'Denominator = 0.2+0.6+0.4 = 1.2.'],
          result: 'Center of gravity = 62/1.2 ≈ 51.67, using the full output shape.',
        },
      },
      {
        title: 'Center average and maximum methods',
        paragraphs: ['Center average uses each consequent center and firing strength: y*=Σαici/Σαi. It is faster than integration and suits singleton or fixed-center consequents.', 'Maximum methods keep only the region at the highest membership. Mean of maxima averages that region, while smallest and largest of maxima choose one endpoint. They are simple but can ignore much of the curve.'],
        formula: 'Center average: y* = Σ αi ci / Σ αi  ;  MOM = average{y | μB(y)=max μB}',
        bullets: ['COG is smooth and uses the whole output.', 'Center average is fast for real-time execution.', 'Maximum methods are useful when only the strongest mode matters.'],
      },
      {
        title: 'Final comparison and system testing',
        paragraphs: ['Choose the defuzzifier according to the application. Continuous control often benefits from smooth center-of-gravity behavior, while a mode selection problem may prefer a maximum method. Test stability, boundary cases, execution time, and sensitivity to noise.', 'A complete workflow validates the final decision against domain knowledge, tests edge cases, monitors oscillation, and then adjusts functions, rules, or defuzzification when needed.'],
      },
    ],
  },
};