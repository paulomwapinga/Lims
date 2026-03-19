# Abnormality Detection Logic - Fixed

## Problem Summary

The laboratory management system was incorrectly classifying all abnormal test results as "HIGH" regardless of whether values were above or below the reference range.

## Root Cause

In `src/lib/abnormalityDetection.ts` line 139, when interpretation rules detected an abnormal result, the code always returned `abnormalityType: 'H'` without checking the direction of the abnormality.

## Solution Implemented

### 1. New Function: `determineAbnormalityType()`

Added intelligent detection logic that determines whether an abnormal result should be marked as HIGH, LOW, or just ABNORMAL based on:

- **Rule type and operator**: For numeric comparisons
  - Operators `>` or `>=` → Result is HIGH (above range)
  - Operators `<` or `<=` → Result is LOW (below range)
  - Operators `=` or `!=` → Check actual value against reference range

- **Reference range comparison**: For range rules or equality operators
  - If value < min reference → LOW
  - If value > max reference → HIGH
  - If neither applies → ABNORMAL (no direction)

- **Non-numeric rules**: Text match and presence rules
  - Return null (general ABNORMAL without direction)

### 2. Updated `detectAbnormalityWithRules()`

Modified to call `determineAbnormalityType()` instead of hardcoding `'H'` when a rule matches and indicates abnormal/critical status.

## Expected Behavior After Fix

| Scenario | Result Classification |
|----------|----------------------|
| Value > max reference | HIGH (H) |
| Value < min reference | LOW (L) |
| Qualitative abnormal (text-based) | ABNORMAL (null) |
| Within normal range | NORMAL |

## Examples

### Example 1: Hemoglobin Test
- Reference range: 12.0 - 16.0 g/dL
- Value entered: 10.5 → **LOW (L)** ✓
- Value entered: 18.0 → **HIGH (H)** ✓
- Value entered: 14.0 → **NORMAL** ✓

### Example 2: WBC Count
- Reference range: 4.0 - 11.0 × 10³/μL
- Value entered: 2.5 → **LOW (L)** ✓
- Value entered: 15.0 → **HIGH (H)** ✓

### Example 3: Urine Protein (Qualitative)
- Allowed values: Negative, Trace, +, ++, +++
- Rule: If value = "++" or "+++" → Abnormal
- Value entered: "++" → **ABNORMAL (no direction)** ✓

## Technical Details

**Files Modified:**
- `src/lib/abnormalityDetection.ts`

**Functions Added:**
- `determineAbnormalityType()`: Intelligently determines HIGH/LOW/ABNORMAL classification

**Functions Updated:**
- `detectAbnormalityWithRules()`: Now uses smart classification instead of hardcoded 'H'

**Database Schema:**
- No changes required
- Existing constraint already supports 'L', 'H', or NULL: `(abnormality_type = ANY (ARRAY['L'::text, 'H'::text])) OR abnormality_type IS NULL`

**UI Components:**
- No changes required
- `LabResultsEntry.tsx` and `LabResultsView.tsx` already properly handle all three states

## Testing Recommendations

1. Test numeric parameters with values above max → should show HIGH
2. Test numeric parameters with values below min → should show LOW
3. Test qualitative parameters with abnormal values → should show ABNORMAL
4. Test values at exact boundaries (min/max values)
5. Verify existing interpretation rules work correctly
