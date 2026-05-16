
-- =====================================================
-- UPDATE EXISTING INOVA PROFILES WITH CORRECT WEIGHTS
-- Source: Catálogo Linha Inova PDF (official document)
-- =====================================================

-- IN-003: PDF=0.546 (was 0.46)
UPDATE item_templates SET weight_per_meter = 0.546, weight_per_bar = 3.276 WHERE name = 'IN-003' AND linha = 'Inova';
-- IN-004: PDF=0.470 (was 0.47 - minor precision)
UPDATE item_templates SET weight_per_meter = 0.470, weight_per_bar = 2.820 WHERE name = 'IN-004' AND linha = 'Inova';
-- IN-005: PDF=0.929
UPDATE item_templates SET weight_per_meter = 0.929, weight_per_bar = 5.574 WHERE name = 'IN-005' AND linha = 'Inova';
-- IN-006: PDF page 17 column alignment unclear, keeping as 0.46
-- IN-007: PDF=0.440
UPDATE item_templates SET weight_per_meter = 0.440, weight_per_bar = 2.640 WHERE name = 'IN-007' AND linha = 'Inova';
-- IN-008: PDF=0.423
UPDATE item_templates SET weight_per_meter = 0.423, weight_per_bar = 2.538 WHERE name = 'IN-008' AND linha = 'Inova';
-- IN-009: PDF=1.018 (was 0.55!)
UPDATE item_templates SET weight_per_meter = 1.018, weight_per_bar = 6.108 WHERE name = 'IN-009' AND linha = 'Inova';
-- IN-010: PDF=0.841 (was 1.02)
UPDATE item_templates SET weight_per_meter = 0.841, weight_per_bar = 5.046 WHERE name = 'IN-010' AND linha = 'Inova';
-- IN-011: PDF=0.635
UPDATE item_templates SET weight_per_meter = 0.635, weight_per_bar = 3.810 WHERE name = 'IN-011' AND linha = 'Inova';
-- IN-012: PDF=0.742 (was 0.72)
UPDATE item_templates SET weight_per_meter = 0.742, weight_per_bar = 4.452 WHERE name = 'IN-012' AND linha = 'Inova';
-- IN-013: PDF=0.713 (was 0.75)
UPDATE item_templates SET weight_per_meter = 0.713, weight_per_bar = 4.278 WHERE name = 'IN-013' AND linha = 'Inova';
-- IN-014: PDF=0.840
UPDATE item_templates SET weight_per_meter = 0.840, weight_per_bar = 5.040 WHERE name = 'IN-014' AND linha = 'Inova';
-- IN-015: PDF=0.503
UPDATE item_templates SET weight_per_meter = 0.503, weight_per_bar = 3.018 WHERE name = 'IN-015' AND linha = 'Inova';
-- IN-016: PDF=1.147 (was 1.15)
UPDATE item_templates SET weight_per_meter = 1.147, weight_per_bar = 6.882 WHERE name = 'IN-016' AND linha = 'Inova';
-- IN-017: PDF=0.134
UPDATE item_templates SET weight_per_meter = 0.134, weight_per_bar = 0.804 WHERE name = 'IN-017' AND linha = 'Inova';
-- IN-018: PDF=0.138 (was 0.14)
UPDATE item_templates SET weight_per_meter = 0.138, weight_per_bar = 0.828 WHERE name = 'IN-018' AND linha = 'Inova';
-- IN-020: PDF=1.023
UPDATE item_templates SET weight_per_meter = 1.023, weight_per_bar = 6.138 WHERE name = 'IN-020' AND linha = 'Inova';
-- IN-021: PDF=0.983
UPDATE item_templates SET weight_per_meter = 0.983, weight_per_bar = 5.898 WHERE name = 'IN-021' AND linha = 'Inova';
-- IN-022: PDF=0.707
UPDATE item_templates SET weight_per_meter = 0.707, weight_per_bar = 4.242 WHERE name = 'IN-022' AND linha = 'Inova';
-- IN-023: PDF=0.823
UPDATE item_templates SET weight_per_meter = 0.823, weight_per_bar = 4.938 WHERE name = 'IN-023' AND linha = 'Inova';
-- IN-024: PDF=0.501
UPDATE item_templates SET weight_per_meter = 0.501, weight_per_bar = 3.006 WHERE name = 'IN-024' AND linha = 'Inova';
-- IN-025: PDF=0.381 (was 0.47!)
UPDATE item_templates SET weight_per_meter = 0.381, weight_per_bar = 2.286 WHERE name = 'IN-025' AND linha = 'Inova';
-- IN-027: PDF=0.973 (was 0.49!)
UPDATE item_templates SET weight_per_meter = 0.973, weight_per_bar = 5.838 WHERE name = 'IN-027' AND linha = 'Inova';
-- IN-028: PDF=0.514
UPDATE item_templates SET weight_per_meter = 0.514, weight_per_bar = 3.084 WHERE name = 'IN-028' AND linha = 'Inova';
-- IN-029: PDF=1.025 (was 1.06)
UPDATE item_templates SET weight_per_meter = 1.025, weight_per_bar = 6.150 WHERE name = 'IN-029' AND linha = 'Inova';
-- IN-031: PDF=0.592
UPDATE item_templates SET weight_per_meter = 0.592, weight_per_bar = 3.552 WHERE name = 'IN-031' AND linha = 'Inova';
-- IN-032: PDF=0.569 (was 0.97!)
UPDATE item_templates SET weight_per_meter = 0.569, weight_per_bar = 3.414 WHERE name = 'IN-032' AND linha = 'Inova';
-- IN-033: PDF=1.058
UPDATE item_templates SET weight_per_meter = 1.058, weight_per_bar = 6.348 WHERE name = 'IN-033' AND linha = 'Inova';
-- IN-034: PDF=0.606 (was 0.38!)
UPDATE item_templates SET weight_per_meter = 0.606, weight_per_bar = 3.636 WHERE name = 'IN-034' AND linha = 'Inova';
-- IN-036: PDF=0.987 (was 0.42!)
UPDATE item_templates SET weight_per_meter = 0.987, weight_per_bar = 5.922 WHERE name = 'IN-036' AND linha = 'Inova';
-- IN-037: PDF=0.208 (was 0.45!)
UPDATE item_templates SET weight_per_meter = 0.208, weight_per_bar = 1.248 WHERE name = 'IN-037' AND linha = 'Inova';
-- IN-038: PDF=1.359 (was 0.48!)
UPDATE item_templates SET weight_per_meter = 1.359, weight_per_bar = 8.154 WHERE name = 'IN-038' AND linha = 'Inova';
-- IN-039: PDF=1.216 (was 0.50!)
UPDATE item_templates SET weight_per_meter = 1.216, weight_per_bar = 7.296 WHERE name = 'IN-039' AND linha = 'Inova';
-- IN-051: PDF=0.677 (was 0.62)
UPDATE item_templates SET weight_per_meter = 0.677, weight_per_bar = 4.062 WHERE name = 'IN-051' AND linha = 'Inova';
-- IN-054: PDF=0.210 (was 0.70!)
UPDATE item_templates SET weight_per_meter = 0.210, weight_per_bar = 1.260 WHERE name = 'IN-054' AND linha = 'Inova';
-- IN-055: PDF=0.311 (was 0.55!)
UPDATE item_templates SET weight_per_meter = 0.311, weight_per_bar = 1.866 WHERE name = 'IN-055' AND linha = 'Inova';
-- IN-056: PDF=0.349 (was 0.58!)
UPDATE item_templates SET weight_per_meter = 0.349, weight_per_bar = 2.094 WHERE name = 'IN-056' AND linha = 'Inova';
-- IN-058: PDF=0.370 (was 0.65!)
UPDATE item_templates SET weight_per_meter = 0.370, weight_per_bar = 2.220 WHERE name = 'IN-058' AND linha = 'Inova';
-- IN-061: PDF=0.449 (was 0.72!)
UPDATE item_templates SET weight_per_meter = 0.449, weight_per_bar = 2.694 WHERE name = 'IN-061' AND linha = 'Inova';
-- IN-063: PDF=0.431 (was 0.68!)
UPDATE item_templates SET weight_per_meter = 0.431, weight_per_bar = 2.586 WHERE name = 'IN-063' AND linha = 'Inova';
-- IN-065: PDF=0.612 (was 0.52)
UPDATE item_templates SET weight_per_meter = 0.612, weight_per_bar = 3.672 WHERE name = 'IN-065' AND linha = 'Inova';
-- IN-066: PDF=0.685 (was 0.48!)
UPDATE item_templates SET weight_per_meter = 0.685, weight_per_bar = 4.110 WHERE name = 'IN-066' AND linha = 'Inova';
-- IN-068: PDF=1.038 (was 0.56!)
UPDATE item_templates SET weight_per_meter = 1.038, weight_per_bar = 6.228 WHERE name = 'IN-068' AND linha = 'Inova';
-- IN-069: PDF=1.079 (was 0.60!)
UPDATE item_templates SET weight_per_meter = 1.079, weight_per_bar = 6.474 WHERE name = 'IN-069' AND linha = 'Inova';
-- IN-079: PDF=1.014 (was 0.75!)
UPDATE item_templates SET weight_per_meter = 1.014, weight_per_bar = 6.084 WHERE name = 'IN-079' AND linha = 'Inova';
-- IN-094: PDF=1.202 (was 0.85!)
UPDATE item_templates SET weight_per_meter = 1.202, weight_per_bar = 7.212 WHERE name = 'IN-094' AND linha = 'Inova';
-- IN-102: PDF=0.560 (was 0.90!)
UPDATE item_templates SET weight_per_meter = 0.560, weight_per_bar = 3.360 WHERE name = 'IN-102' AND linha = 'Inova';
-- IN-109: PDF=0.888 (was 0.78)
UPDATE item_templates SET weight_per_meter = 0.888, weight_per_bar = 5.328 WHERE name = 'IN-109' AND linha = 'Inova';
-- IN-110: PDF=0.485 (was 0.82!)
UPDATE item_templates SET weight_per_meter = 0.485, weight_per_bar = 2.910 WHERE name = 'IN-110' AND linha = 'Inova';
-- IN-113: PDF=1.048 (was 0.65!)
UPDATE item_templates SET weight_per_meter = 1.048, weight_per_bar = 6.288 WHERE name = 'IN-113' AND linha = 'Inova';
-- IN-114: PDF=0.616
UPDATE item_templates SET weight_per_meter = 0.616, weight_per_bar = 3.696 WHERE name = 'IN-114' AND linha = 'Inova';
-- IN-115: PDF=0.916
UPDATE item_templates SET weight_per_meter = 0.916, weight_per_bar = 5.496 WHERE name = 'IN-115' AND linha = 'Inova';
-- IN-117: PDF=0.723
UPDATE item_templates SET weight_per_meter = 0.723, weight_per_bar = 4.338 WHERE name = 'IN-117' AND linha = 'Inova';
-- IN-121: PDF=1.301
UPDATE item_templates SET weight_per_meter = 1.301, weight_per_bar = 7.806 WHERE name = 'IN-121' AND linha = 'Inova';
-- IN-122: PDF=1.390 (was 0.70! - was swapped with IN-123)
UPDATE item_templates SET weight_per_meter = 1.390, weight_per_bar = 8.340 WHERE name = 'IN-122' AND linha = 'Inova';
-- IN-123: PDF=0.739 (was 1.39! - was swapped with IN-122)
UPDATE item_templates SET weight_per_meter = 0.739, weight_per_bar = 4.434 WHERE name = 'IN-123' AND linha = 'Inova';
-- IN-128: PDF=0.517
UPDATE item_templates SET weight_per_meter = 0.517, weight_per_bar = 3.102 WHERE name = 'IN-128' AND linha = 'Inova';
-- IN-129: PDF=0.963
UPDATE item_templates SET weight_per_meter = 0.963, weight_per_bar = 5.778 WHERE name = 'IN-129' AND linha = 'Inova';
-- IN-130: PDF=0.477
UPDATE item_templates SET weight_per_meter = 0.477, weight_per_bar = 2.862 WHERE name = 'IN-130' AND linha = 'Inova';
-- IN-131: PDF=1.032
UPDATE item_templates SET weight_per_meter = 1.032, weight_per_bar = 6.192 WHERE name = 'IN-131' AND linha = 'Inova';
-- IN-132: PDF=0.477
UPDATE item_templates SET weight_per_meter = 0.477, weight_per_bar = 2.862 WHERE name = 'IN-132' AND linha = 'Inova';
-- IN-134: PDF=0.715 (was 0.88!)
UPDATE item_templates SET weight_per_meter = 0.715, weight_per_bar = 4.290 WHERE name = 'IN-134' AND linha = 'Inova';
-- IN-139: PDF=0.858 (was 0.72!)
UPDATE item_templates SET weight_per_meter = 0.858, weight_per_bar = 5.148 WHERE name = 'IN-139' AND linha = 'Inova';
-- IN-151: PDF=0.698 (was 0.86!)
UPDATE item_templates SET weight_per_meter = 0.698, weight_per_bar = 4.188 WHERE name = 'IN-151' AND linha = 'Inova';
-- IN-155: PDF=0.501 (was 0.70!)
UPDATE item_templates SET weight_per_meter = 0.501, weight_per_bar = 3.006 WHERE name = 'IN-155' AND linha = 'Inova';
-- IN-159: PDF=0.740
UPDATE item_templates SET weight_per_meter = 0.740, weight_per_bar = 4.440 WHERE name = 'IN-159' AND linha = 'Inova';

-- Update non-IN profiles that exist
-- MH-001: PDF=0.786 (was 0.8)
UPDATE item_templates SET weight_per_meter = 0.786, weight_per_bar = 4.716 WHERE name = 'MH-001' AND linha = 'Inova';
-- MH-004: PDF=1.323 (was 0.61!)
UPDATE item_templates SET weight_per_meter = 1.323, weight_per_bar = 7.938 WHERE name = 'MH-004' AND linha = 'Inova';
-- MH-006: PDF=0.697 (was 0.70)
UPDATE item_templates SET weight_per_meter = 0.697, weight_per_bar = 4.182 WHERE name = 'MH-006' AND linha = 'Inova';
-- MH-008: PDF=0.820
UPDATE item_templates SET weight_per_meter = 0.820, weight_per_bar = 4.920 WHERE name = 'MH-008' AND linha = 'Inova';
-- RM-021: PDF=0.212 (was 0.22)
UPDATE item_templates SET weight_per_meter = 0.212, weight_per_bar = 1.272 WHERE name = 'RM-021' AND linha = 'Inova';
