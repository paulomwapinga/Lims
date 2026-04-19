export interface AbnormalityResult {
  isAbnormal: boolean;
  abnormalityType: 'L' | 'H' | null;
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
