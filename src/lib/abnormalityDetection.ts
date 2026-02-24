import { supabase } from './supabase';

export interface AbnormalityResult {
  isAbnormal: boolean;
  abnormalityType: 'L' | 'H' | null;
}

export interface InterpretationRule {
  id: string;
  parameter_id: string;
  rule_type: 'numeric_comparison' | 'text_match' | 'range' | 'presence';
  operator: '>' | '<' | '>=' | '<=' | '=' | '!=' | 'between' | 'in' | 'contains' | 'exists' | 'not_exists';
  value: string;
  result_status: 'normal' | 'abnormal' | 'critical';
  priority: number;
  active: boolean;
}

export async function getInterpretationRules(parameterId: string): Promise<InterpretationRule[]> {
  const { data, error } = await supabase
    .from('test_parameter_rules')
    .select('*')
    .eq('parameter_id', parameterId)
    .eq('active', true)
    .order('priority', { ascending: true });

  if (error) {
    console.error('Error loading interpretation rules:', error);
    return [];
  }

  return data || [];
}

export function applyInterpretationRule(value: string, rule: InterpretationRule): boolean {
  const trimmedValue = value.trim().toLowerCase();

  switch (rule.rule_type) {
    case 'numeric_comparison':
      return applyNumericComparison(value, rule.operator, rule.value);

    case 'text_match':
      return applyTextMatch(trimmedValue, rule.operator, rule.value);

    case 'range':
      return applyRangeCheck(value, rule.operator, rule.value);

    case 'presence':
      return applyPresenceCheck(trimmedValue, rule.operator);

    default:
      return false;
  }
}

function applyNumericComparison(value: string, operator: string, ruleValue: string): boolean {
  const numValue = parseNumericValue(value);
  if (numValue === null) return false;

  const compareValue = parseFloat(ruleValue);
  if (isNaN(compareValue)) return false;

  switch (operator) {
    case '>': return numValue > compareValue;
    case '<': return numValue < compareValue;
    case '>=': return numValue >= compareValue;
    case '<=': return numValue <= compareValue;
    case '=': return numValue === compareValue;
    case '!=': return numValue !== compareValue;
    default: return false;
  }
}

function applyTextMatch(value: string, operator: string, ruleValue: string): boolean {
  const compareValues = ruleValue.toLowerCase().split('|').map(v => v.trim());

  switch (operator) {
    case '=':
      return compareValues.includes(value);
    case '!=':
      return !compareValues.includes(value);
    case 'in':
      return compareValues.some(v => value.includes(v));
    case 'contains':
      return compareValues.some(v => value.includes(v));
    default:
      return false;
  }
}

function applyRangeCheck(value: string, operator: string, ruleValue: string): boolean {
  const numValue = parseNumericValue(value);
  if (numValue === null) return false;

  if (operator === 'between') {
    try {
      const range = JSON.parse(ruleValue);
      const min = parseFloat(range.min);
      const max = parseFloat(range.max);
      return numValue >= min && numValue <= max;
    } catch {
      return false;
    }
  }

  return false;
}

function applyPresenceCheck(value: string, operator: string): boolean {
  const isEmpty = value === '' || value === 'nil' || value === 'none' || value === '-';

  switch (operator) {
    case 'exists':
      return !isEmpty;
    case 'not_exists':
      return isEmpty;
    default:
      return false;
  }
}

function parseNumericValue(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const numValue = parseFloat(cleaned);
  return isNaN(numValue) ? null : numValue;
}

export async function detectAbnormalityWithRules(
  value: string,
  parameterId: string,
  refRangeFrom: number | null,
  refRangeTo: number | null
): Promise<AbnormalityResult> {
  const rules = await getInterpretationRules(parameterId);

  for (const rule of rules) {
    if (applyInterpretationRule(value, rule)) {
      if (rule.result_status === 'abnormal' || rule.result_status === 'critical') {
        return { isAbnormal: true, abnormalityType: 'H' };
      } else if (rule.result_status === 'normal') {
        return { isAbnormal: false, abnormalityType: null };
      }
    }
  }

  return detectAbnormality(value, refRangeFrom, refRangeTo);
}

export function detectAbnormality(
  value: string,
  refRangeFrom: number | null,
  refRangeTo: number | null
): AbnormalityResult {
  const numericValue = parseFloat(value);

  if (isNaN(numericValue)) {
    return { isAbnormal: false, abnormalityType: null };
  }

  if (refRangeFrom !== null && numericValue < refRangeFrom) {
    return { isAbnormal: true, abnormalityType: 'L' };
  }

  if (refRangeTo !== null && numericValue > refRangeTo) {
    return { isAbnormal: true, abnormalityType: 'H' };
  }

  return { isAbnormal: false, abnormalityType: null };
}
