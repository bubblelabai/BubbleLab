import {
  PersonFunctionEnum,
  PersonSeniorityLevelEnum,
} from '../service-bubble/crustdata/index.js';

// Valid enum values from Crustdata API
const VALID_SENIORITY_LEVELS = PersonSeniorityLevelEnum._def
  .values as readonly string[];
const VALID_FUNCTION_CATEGORIES = PersonFunctionEnum._def
  .values as readonly string[];

// Common aliases for seniority levels
const SENIORITY_ALIASES: Record<string, string> = {
  // CXO variations
  'c-level': 'CXO',
  'c-suite': 'CXO',
  clevel: 'CXO',
  csuite: 'CXO',
  executive: 'CXO',
  chief: 'CXO',
  ceo: 'CXO',
  cto: 'CXO',
  cfo: 'CXO',
  coo: 'CXO',
  cmo: 'CXO',
  cio: 'CXO',
  cpo: 'CXO',
  // VP variations
  vp: 'Vice President',
  'vice-president': 'Vice President',
  vicepresident: 'Vice President',
  svp: 'Vice President',
  evp: 'Vice President',
  avp: 'Vice President',
  // Director variations
  dir: 'Director',
  // Manager variations
  manager: 'Experienced Manager',
  mgr: 'Experienced Manager',
  'senior manager': 'Experienced Manager',
  'sr manager': 'Experienced Manager',
  'junior manager': 'Entry Level Manager',
  'jr manager': 'Entry Level Manager',
  'new manager': 'Entry Level Manager',
  // Senior variations
  sr: 'Senior',
  'senior level': 'Senior',
  experienced: 'Senior',
  // Entry level variations
  entry: 'Entry Level',
  junior: 'Entry Level',
  jr: 'Entry Level',
  associate: 'Entry Level',
  // Owner variations
  owner: 'Owner / Partner',
  partner: 'Owner / Partner',
  'co-founder': 'Owner / Partner',
  cofounder: 'Owner / Partner',
  founder: 'Owner / Partner',
  // Training variations
  intern: 'In Training',
  trainee: 'In Training',
  apprentice: 'In Training',
};

// Common aliases for function categories
const FUNCTION_ALIASES: Record<string, string> = {
  // Engineering variations
  eng: 'Engineering',
  engineer: 'Engineering',
  software: 'Engineering',
  development: 'Engineering',
  dev: 'Engineering',
  tech: 'Engineering',
  technical: 'Engineering',
  'r&d': 'Engineering',
  // IT variations
  it: 'Information Technology',
  'information tech': 'Information Technology',
  'info tech': 'Information Technology',
  technology: 'Information Technology',
  // HR variations
  hr: 'Human Resources',
  people: 'Human Resources',
  talent: 'Human Resources',
  recruiting: 'Human Resources',
  recruitment: 'Human Resources',
  // Product Management variations
  pm: 'Product Management',
  product: 'Product Management',
  // Project Management variations
  'project management': 'Program and Project Management',
  'program management': 'Program and Project Management',
  pmo: 'Program and Project Management',
  // Sales variations
  'sales rep': 'Sales',
  'account executive': 'Sales',
  ae: 'Sales',
  sdr: 'Sales',
  bdr: 'Sales',
  // Marketing variations
  mktg: 'Marketing',
  growth: 'Marketing',
  'demand gen': 'Marketing',
  // Finance variations
  fin: 'Finance',
  financial: 'Finance',
  'fp&a': 'Finance',
  treasury: 'Finance',
  // Operations variations
  ops: 'Operations',
  'operations management': 'Operations',
  // Business Development variations
  bd: 'Business Development',
  'biz dev': 'Business Development',
  bizdev: 'Business Development',
  partnerships: 'Business Development',
  // Customer Success variations
  cs: 'Customer Success and Support',
  'customer success': 'Customer Success and Support',
  'customer support': 'Customer Success and Support',
  support: 'Customer Success and Support',
  cx: 'Customer Success and Support',
  'customer experience': 'Customer Success and Support',
  // Design variations
  design: 'Arts and Design',
  ux: 'Arts and Design',
  ui: 'Arts and Design',
  creative: 'Arts and Design',
  // QA variations
  qa: 'Quality Assurance',
  quality: 'Quality Assurance',
  testing: 'Quality Assurance',
  // Admin variations
  admin: 'Administrative',
  office: 'Administrative',
  'executive assistant': 'Administrative',
  ea: 'Administrative',
  // Legal variations
  law: 'Legal',
  lawyer: 'Legal',
  counsel: 'Legal',
  attorney: 'Legal',
  // Healthcare variations
  healthcare: 'Healthcare Services',
  health: 'Healthcare Services',
  medical: 'Healthcare Services',
  // Media variations
  media: 'Media and Communication',
  communications: 'Media and Communication',
  comms: 'Media and Communication',
  pr: 'Media and Communication',
  'public relations': 'Media and Communication',
};

/**
 * Calculate similarity between two strings using Levenshtein distance
 * Returns a score between 0 and 1 (1 = exact match)
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Create matrix
  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - distance / maxLen;
}

/**
 * Normalize a seniority level input to match valid API values
 * Handles case-insensitivity, aliases, and fuzzy matching
 */
export function normalizeSeniorityLevel(input: string): string | null {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // 1. Exact match (case-insensitive)
  for (const valid of VALID_SENIORITY_LEVELS) {
    if (valid.toLowerCase() === lower) {
      return valid;
    }
  }

  // 2. Check aliases
  if (SENIORITY_ALIASES[lower]) {
    return SENIORITY_ALIASES[lower];
  }

  // 3. Fuzzy match - find best match above threshold
  let bestMatch: string | null = null;
  let bestScore = 0;
  const threshold = 0.6; // Minimum similarity required

  for (const valid of VALID_SENIORITY_LEVELS) {
    const score = stringSimilarity(trimmed, valid);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = valid;
    }
  }

  return bestMatch;
}

/**
 * Normalize a function category input to match valid API values
 * Handles case-insensitivity, aliases, and fuzzy matching
 */
export function normalizeFunctionCategory(input: string): string | null {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // 1. Exact match (case-insensitive)
  for (const valid of VALID_FUNCTION_CATEGORIES) {
    if (valid.toLowerCase() === lower) {
      return valid;
    }
  }

  // 2. Check aliases
  if (FUNCTION_ALIASES[lower]) {
    return FUNCTION_ALIASES[lower];
  }

  // 3. Fuzzy match - find best match above threshold
  let bestMatch: string | null = null;
  let bestScore = 0;
  const threshold = 0.6; // Minimum similarity required

  for (const valid of VALID_FUNCTION_CATEGORIES) {
    const score = stringSimilarity(trimmed, valid);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = valid;
    }
  }

  return bestMatch;
}

/**
 * Normalize an array of seniority levels, filtering out invalid values
 */
export function normalizeSeniorityLevels(inputs: string[]): string[] {
  const normalized: string[] = [];
  for (const input of inputs) {
    const result = normalizeSeniorityLevel(input);
    if (result && !normalized.includes(result)) {
      normalized.push(result);
    }
  }
  return normalized;
}

/**
 * Normalize an array of function categories, filtering out invalid values
 */
export function normalizeFunctionCategories(inputs: string[]): string[] {
  const normalized: string[] = [];
  for (const input of inputs) {
    const result = normalizeFunctionCategory(input);
    if (result && !normalized.includes(result)) {
      normalized.push(result);
    }
  }
  return normalized;
}
