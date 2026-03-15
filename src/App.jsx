import { useState, useEffect, useRef, useCallback } from "react";

/* ─── Colour Palette — Octopus Money inspired ─── */
const C = {
  // Backgrounds — from Octopus CSS: --stone-background: #F9F3F0; --custom-sand: #f9f3f0
  bg: "#F9F3F0",           // exact Octopus stone/sand background
  bgAlt: "#ffffff",         // pure white for inputs/cards
  card: "#ffffff",
  cardHover: "#f3eeea",
  border: "#e2ddd7",
  borderLit: "#F050F733",
  // Text — from Octopus CSS: --primary-dark-blue: #0E012E
  text: "#0E012E",          // exact Octopus primary dark blue
  textSoft: "#3a2d55",      // muted purple-navy (between dark blue and grey)
  textDim: "#857e96",       // soft purple-grey
  // Primary accent — from Octopus CSS: --primary-pink: #F050F7
  pink: "#F050F7",          // exact Octopus primary pink
  pinkGlow: "#F050F718",
  pinkLight: "#faceff",     // exact Octopus --custom-lightest-pink
  pinkHover: "#FFACFF",     // exact Octopus --button-hover
  // Data/info colours — from Octopus CSS palette
  cyan: "#2A9A86",          // exact Octopus --grass-green
  cyanGlow: "#2A9A8618",
  blue: "#52ACFF",          // exact Octopus --jean-blue
  blueGlow: "#52ACFF18",
  violet: "#A84BE1",        // exact Octopus --purple
  violetGlow: "#A84BE118",
  ice: "#0E012E",           // use exact dark blue for strong highlights
  red: "#cf2e2e",           // exact Octopus --vivid-red
  green: "#2A9A86",         // exact Octopus --grass-green
  greenDim: "#2A9A8620",
  greenLight: "#e8f5f1",
  gridLine: "#e2ddd7",
  gridLineFaint: "#f3eeea",
  amber: "#FF9356",         // exact Octopus --warm-orange
  amberLight: "#fff4ed",
  blueLight: "#ebf4ff",     // tinted from jean-blue
  violetLight: "#f3eafc",   // tinted from purple
  redLight: "#fef2f2",
  tealLight: "#e8f5f1",     // tinted from grass-green
  textLink: "#C30ACD",      // exact Octopus --text-link
  // Chart-specific colours — from Octopus CSS palette
  chartYellow: "#FFD25E",   // exact Octopus --warm-yellow (ISA)
  chartCoral: "#FF8DFF",    // exact Octopus --light-pink (DC Pension)
  chartBlue: "#52ACFF",     // exact Octopus --jean-blue (State Pension)
  chartAmber: "#FF9356",    // exact Octopus --warm-orange (GIA)
  chartRed: "#cf2e2e",      // exact Octopus --vivid-red (Tax)
  chartGreen: "#B1FF64",    // exact Octopus --acid-green (on-track indicator)
};

/* ─── No SVG texture patterns needed — clean design ─── */
const TEXTURES = {
  grid: "none",
  dashedGrid: "none",
  diagonalHatch: "none",
  crossHatch: "none",
  dotGrid: "none",
};

/* ─── Tax Year Config (2025/26 — defaults, can be overridden via settings) ─── */
/* Source: GOV.UK — Income Tax rates and Personal Allowances
   https://www.gov.uk/income-tax-rates
   All values confirmed against HMRC published rates for 2025/26. */
const DEFAULT_TAX_CONFIG = {
  year: "2025/26",
  statePension: {
    fullWeeklyRate: 230.25,        // £/week — full new State Pension
    fullAnnualRate: 11973,         // £230.25 × 52
    qualifyingYearsForFull: 35,
    minimumQualifyingYears: 10,
  },
  incomeTax: {
    personalAllowance: 12570,       // Standard PA — £12,570
    personalAllowanceTaperStart: 100000,
    personalAllowanceTaperEnd: 125140,
    basicRate: 0.20,
    basicRateLimit: 37700,
    basicRateThreshold: 50270,
    higherRate: 0.40,
    higherRateThreshold: 125140,
    additionalRate: 0.45,
  },
  pensionAllowance: {
    annualAllowance: 60000,
    moneyPurchaseAA: 10000,
    taperThresholdIncome: 200000,
    taperAdjustedIncome: 260000,
    minimumTaperedAA: 10000,
  },
  isaAllowance: {
    annualAllowance: 20000,
  },
  capitalGainsTax: {
    annualExemptAmount: 3000,
    basicRate: 0.18,
    higherRate: 0.24,
  },
  retirementStandards: {
    minimum:    { one: 13400, two: 21600, label: "Minimum",    desc: "Covers all your needs, with some left over for fun" },
    moderate:   { one: 31700, two: 43900, label: "Moderate",   desc: "More financial security and flexibility — includes a car and a foreign holiday" },
    comfortable:{ one: 43900, two: 60600, label: "Comfortable",desc: "More financial freedom and some luxuries" },
  },
};

/* ─── Save File Schema ─── */
const SAVE_SCHEMA_VERSION = 1;
const SAVE_FILE_MAGIC = "RETIRECLEAR";

function createSaveData(inputs, taxConfig) {
  return {
    magic: SAVE_FILE_MAGIC,
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    savedAtReadable: new Date().toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }),
    taxConfig,
    inputs,
  };
}

function validateSaveData(data) {
  if (!data || typeof data !== "object") return { valid: false, error: "Not a valid file" };
  if (data.magic !== SAVE_FILE_MAGIC) return { valid: false, error: "Not a RetireClear save file" };
  if (!data.schemaVersion) return { valid: false, error: "Missing schema version" };
  if (!data.inputs) return { valid: false, error: "Missing input data" };

  if (data.taxConfig) {
    const merged = JSON.parse(JSON.stringify(DEFAULT_TAX_CONFIG));
    for (const section of Object.keys(merged)) {
      if (data.taxConfig[section] && typeof merged[section] === "object" && !Array.isArray(merged[section])) {
        merged[section] = { ...merged[section], ...data.taxConfig[section] };
      } else if (data.taxConfig[section] !== undefined) {
        merged[section] = data.taxConfig[section];
      }
    }
    if (data.taxConfig.year) merged.year = data.taxConfig.year;
    data.taxConfig = merged;
  }

  return { valid: true, data };
}

let TAX_CONFIG = JSON.parse(JSON.stringify(DEFAULT_TAX_CONFIG));

/* ─── State Pension Calculation Engine ─── */
function calculateStatePension(inputs) {
  const { qualifyingYearsCurrent, qualifyingYearsFuture, weeklyForecast, statePensionAge, dateOfBirth } = inputs;
  const config = TAX_CONFIG.statePension;

  if (weeklyForecast && weeklyForecast > 0) {
    const annual = weeklyForecast * 52;
    const monthly = annual / 12;
    const totalQualifyingYears = qualifyingYearsCurrent + qualifyingYearsFuture;
    const onTrackForFull = weeklyForecast >= config.fullWeeklyRate - 0.01;

    return {
      weeklyAmount: weeklyForecast,
      monthlyAmount: monthly,
      annualAmount: annual,
      qualifyingYearsCurrent,
      qualifyingYearsFuture,
      totalQualifyingYears,
      onTrackForFull,
      usedForecast: true,
      statePensionAge,
      statePensionDate: calculateSPDate(dateOfBirth, statePensionAge),
    };
  }

  const totalYears = qualifyingYearsCurrent + qualifyingYearsFuture;
  const cappedYears = Math.min(totalYears, config.qualifyingYearsForFull);

  let weeklyAmount = 0;
  if (cappedYears >= config.minimumQualifyingYears) {
    weeklyAmount = (cappedYears / config.qualifyingYearsForFull) * config.fullWeeklyRate;
  }

  const annualAmount = weeklyAmount * 52;
  const monthlyAmount = annualAmount / 12;

  return {
    weeklyAmount: Math.round(weeklyAmount * 100) / 100,
    monthlyAmount: Math.round(monthlyAmount * 100) / 100,
    annualAmount: Math.round(annualAmount * 100) / 100,
    qualifyingYearsCurrent,
    qualifyingYearsFuture,
    totalQualifyingYears: totalYears,
    onTrackForFull: cappedYears >= config.qualifyingYearsForFull,
    usedForecast: false,
    statePensionAge,
    statePensionDate: calculateSPDate(dateOfBirth, statePensionAge),
  };
}

function calculateSPDate(dob, spaAge) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;
  const spDate = new Date(birthDate);
  spDate.setFullYear(spDate.getFullYear() + spaAge);
  return spDate;
}

function formatDate(date) {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatCurrency(amount, decimals = 0) {
  if (amount === null || amount === undefined || isNaN(amount)) return "£0";
  return "£" + amount.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/* ─── Full Income Tax Engine (2025/26) ─── */
function calculateIncomeTax(grossIncome) {
  const T = TAX_CONFIG.incomeTax;

  let personalAllowance = T.personalAllowance;
  let taperReduction = 0;

  if (grossIncome > T.personalAllowanceTaperStart) {
    taperReduction = Math.min(
      Math.floor((grossIncome - T.personalAllowanceTaperStart) / 2),
      T.personalAllowance
    );
    personalAllowance = Math.max(0, T.personalAllowance - taperReduction);
  }

  const isPATapered = taperReduction > 0;
  const isPAFullyTapered = personalAllowance === 0;

  const taxableIncome = Math.max(0, grossIncome - personalAllowance);
  if (taxableIncome <= 0) {
    return {
      grossIncome: Math.round(grossIncome),
      personalAllowance,
      personalAllowanceUsed: Math.round(Math.min(grossIncome, personalAllowance)),
      personalAllowanceRemaining: Math.round(Math.max(0, personalAllowance - grossIncome)),
      taperReduction: Math.round(taperReduction),
      isPATapered,
      isPAFullyTapered,
      taxableIncome: 0,
      basicRateAmount: 0, basicRateTax: 0,
      higherRateAmount: 0, higherRateTax: 0,
      additionalRateAmount: 0, additionalRateTax: 0,
      totalTax: 0,
      netIncome: Math.round(grossIncome),
      effectiveRate: 0,
      marginalRate: 0,
      bands: grossIncome > 0 ? [{
        name: "Personal Allowance",
        rate: 0,
        amount: Math.round(grossIncome),
        tax: 0,
        color: C.green,
      }] : [],
    };
  }

  const basicRateAmount = Math.min(taxableIncome, T.basicRateLimit);
  const basicRateTax = basicRateAmount * T.basicRate;

  const higherRateBandWidth = T.higherRateThreshold - personalAllowance - T.basicRateLimit;
  const higherRateAmount = Math.max(0, Math.min(taxableIncome - T.basicRateLimit, higherRateBandWidth));
  const higherRateTax = higherRateAmount * T.higherRate;

  const additionalRateStart = T.basicRateLimit + Math.max(0, higherRateBandWidth);
  const additionalRateAmount = Math.max(0, taxableIncome - additionalRateStart);
  const additionalRateTax = additionalRateAmount * T.additionalRate;

  const totalTax = Math.round(basicRateTax + higherRateTax + additionalRateTax);
  const netIncome = Math.round(grossIncome - totalTax);
  const effectiveRate = grossIncome > 0 ? totalTax / grossIncome : 0;

  let marginalRate = 0;
  if (grossIncome > T.personalAllowanceTaperStart && grossIncome <= T.personalAllowanceTaperEnd) {
    marginalRate = 0.60;
  } else if (taxableIncome <= T.basicRateLimit) {
    marginalRate = grossIncome <= personalAllowance ? 0 : T.basicRate;
  } else if (taxableIncome <= T.basicRateLimit + higherRateBandWidth) {
    marginalRate = T.higherRate;
  } else {
    marginalRate = T.additionalRate;
  }

  const bands = [];
  if (personalAllowance > 0 && grossIncome > 0) {
    bands.push({
      name: "Personal Allowance",
      rate: 0,
      amount: Math.round(Math.min(grossIncome, personalAllowance)),
      tax: 0,
      color: "#7de2a8",  // light green — tax-free band
    });
  }
  if (basicRateAmount > 0) {
    bands.push({
      name: "Basic Rate",
      rate: T.basicRate,
      amount: Math.round(basicRateAmount),
      tax: Math.round(basicRateTax),
      color: C.blue,     // jean blue — basic rate
    });
  }
  if (higherRateAmount > 0) {
    bands.push({
      name: "Higher Rate",
      rate: T.higherRate,
      amount: Math.round(higherRateAmount),
      tax: Math.round(higherRateTax),
      color: C.amber,    // warm orange — higher rate
    });
  }
  if (additionalRateAmount > 0) {
    bands.push({
      name: "Additional Rate",
      rate: T.additionalRate,
      amount: Math.round(additionalRateAmount),
      tax: Math.round(additionalRateTax),
      color: C.red,      // red — additional rate
    });
  }

  return {
    grossIncome: Math.round(grossIncome),
    personalAllowance,
    personalAllowanceUsed: Math.round(Math.min(grossIncome, personalAllowance)),
    personalAllowanceRemaining: Math.round(Math.max(0, personalAllowance - grossIncome)),
    taperReduction: Math.round(taperReduction),
    isPATapered,
    isPAFullyTapered,
    taxableIncome: Math.round(taxableIncome),
    basicRateAmount: Math.round(basicRateAmount),
    basicRateTax: Math.round(basicRateTax),
    higherRateAmount: Math.round(higherRateAmount),
    higherRateTax: Math.round(higherRateTax),
    additionalRateAmount: Math.round(additionalRateAmount),
    additionalRateTax: Math.round(additionalRateTax),
    totalTax,
    netIncome,
    effectiveRate,
    marginalRate,
    bands,
  };
}

/* ─── DC Pension Calculation Engine ─── */
function calculateDCPension(inputs) {
  const {
    currentPotValue,
    monthlyContributionYours,
    monthlyContributionEmployer,
    annualGrowthRate,
    inflationRate,
    retireAge,
    currentAge,
    lumpSumMode,
    planToAge,
    statePensionAge,
    statePensionAnnual,
  } = inputs;

  const realGrowthRate = ((1 + annualGrowthRate / 100) / (1 + inflationRate / 100)) - 1;
  const monthlyRealGrowth = Math.pow(1 + realGrowthRate, 1 / 12) - 1;

  const totalMonthlyContribution = monthlyContributionYours + monthlyContributionEmployer;

  const yearsToRetirement = Math.max(0, retireAge - currentAge);
  const monthsToRetirement = Math.round(yearsToRetirement * 12);

  let potAtRetirement = currentPotValue;
  for (let m = 0; m < monthsToRetirement; m++) {
    potAtRetirement = potAtRetirement * (1 + monthlyRealGrowth) + totalMonthlyContribution;
  }

  const upfrontLumpSum = lumpSumMode === "upfront" ? potAtRetirement * 0.25 : 0;
  const potEnteringDrawdown = potAtRetirement - upfrontLumpSum;

  const drawdownYears = Math.max(1, planToAge - retireAge);
  const r = realGrowthRate;

  let annualDrawdown;
  if (Math.abs(r) < 0.0001 || drawdownYears <= 0) {
    annualDrawdown = drawdownYears > 0 ? potEnteringDrawdown / drawdownYears : 0;
  } else {
    annualDrawdown = potEnteringDrawdown * r / (1 - Math.pow(1 + r, -drawdownYears));
  }
  const monthlyDrawdown = annualDrawdown / 12;

  const impliedDrawdownRate = potEnteringDrawdown > 0
    ? (annualDrawdown / potEnteringDrawdown) * 100
    : 0;

  const taxFreePerWithdrawal = lumpSumMode === "phased" ? 0.25 : 0;

  let drawdownPot = potEnteringDrawdown;
  let potLastsUntilAge = retireAge;
  let totalTaxFreeTaken = upfrontLumpSum;
  const drawdownTimeline = [];

  for (let age = retireAge; age <= planToAge; age++) {
    const yearStart = drawdownPot;
    const withdrawal = Math.min(annualDrawdown, Math.max(0, drawdownPot));
    drawdownPot = drawdownPot - withdrawal;
    drawdownPot = drawdownPot * (1 + realGrowthRate);
    drawdownPot = Math.max(0, drawdownPot);

    const taxFreeThisYear = withdrawal * taxFreePerWithdrawal;
    const taxableThisYear = withdrawal - taxFreeThisYear;
    totalTaxFreeTaken += taxFreeThisYear;

    drawdownTimeline.push({
      age,
      potStart: yearStart,
      withdrawal,
      taxFreeIncome: taxFreeThisYear,
      taxableIncome: taxableThisYear,
      potEnd: drawdownPot,
      dcIncome: withdrawal,
      spIncome: age >= statePensionAge ? statePensionAnnual : 0,
      totalIncome: withdrawal + (age >= statePensionAge ? statePensionAnnual : 0),
    });

    if (drawdownPot <= 0 && withdrawal <= 0) {
      potLastsUntilAge = age;
      break;
    }
    potLastsUntilAge = age;
  }

  const potRunsOut = drawdownPot <= 0 && potLastsUntilAge < planToAge;

  return {
    potAtRetirement: Math.round(potAtRetirement),
    upfrontLumpSum: Math.round(upfrontLumpSum),
    potEnteringDrawdown: Math.round(potEnteringDrawdown),
    annualDrawdown: Math.round(annualDrawdown),
    monthlyDrawdown: Math.round(monthlyDrawdown),
    annualTaxFree: Math.round(annualDrawdown * taxFreePerWithdrawal),
    annualTaxable: Math.round(annualDrawdown * (1 - taxFreePerWithdrawal)),
    taxFreePerWithdrawal,
    impliedDrawdownRate,
    potLastsUntilAge,
    potRunsOut,
    drawdownTimeline,
    lumpSumMode,
    planToAge,
    drawdownYears,
    yearsToRetirement: Math.round(yearsToRetirement),
    totalContributed: Math.round(totalMonthlyContribution * monthsToRetirement + currentPotValue),
    investmentGrowth: Math.round(potAtRetirement - (totalMonthlyContribution * monthsToRetirement + currentPotValue)),
  };
}

/* ─── ISA Calculation Engine ─── */
function calculateISA(inputs) {
  const {
    currentBalance,
    monthlyContribution,
    annualGrowthRate,
    inflationRate,
    retireAge,
    currentAge,
    planToAge,
    statePensionAge,
    statePensionAnnual,
  } = inputs;

  const realGrowthRate = ((1 + annualGrowthRate / 100) / (1 + inflationRate / 100)) - 1;
  const monthlyRealGrowth = Math.pow(1 + realGrowthRate, 1 / 12) - 1;

  const yearsToRetirement = Math.max(0, retireAge - currentAge);
  const monthsToRetirement = Math.round(yearsToRetirement * 12);

  let potAtRetirement = currentBalance;
  for (let m = 0; m < monthsToRetirement; m++) {
    potAtRetirement = potAtRetirement * (1 + monthlyRealGrowth) + monthlyContribution;
  }

  const drawdownYears = Math.max(1, planToAge - retireAge);
  const r = realGrowthRate;

  let annualDrawdown;
  if (Math.abs(r) < 0.0001 || drawdownYears <= 0) {
    annualDrawdown = drawdownYears > 0 ? potAtRetirement / drawdownYears : 0;
  } else {
    annualDrawdown = potAtRetirement * r / (1 - Math.pow(1 + r, -drawdownYears));
  }

  let drawdownPot = potAtRetirement;
  let potLastsUntilAge = retireAge;
  const drawdownTimeline = [];

  for (let age = retireAge; age <= planToAge; age++) {
    const yearStart = drawdownPot;
    const withdrawal = Math.min(annualDrawdown, Math.max(0, drawdownPot));
    drawdownPot = drawdownPot - withdrawal;
    drawdownPot = drawdownPot * (1 + realGrowthRate);
    drawdownPot = Math.max(0, drawdownPot);

    drawdownTimeline.push({
      age, potStart: yearStart, withdrawal, potEnd: drawdownPot,
      taxFreeIncome: withdrawal, taxableIncome: 0,
    });

    if (drawdownPot <= 0 && withdrawal <= 0) { potLastsUntilAge = age; break; }
    potLastsUntilAge = age;
  }

  const potRunsOut = drawdownPot <= 0 && potLastsUntilAge < planToAge;

  const bridgeYearsStart = retireAge;
  const bridgeYearsEnd = Math.min(statePensionAge, potLastsUntilAge + 1);
  const bridgeYearsCovered = Math.max(0, bridgeYearsEnd - bridgeYearsStart);

  const effectiveAnnualDrawdown = drawdownTimeline.length > 0 ? drawdownTimeline[0].withdrawal : 0;

  return {
    potAtRetirement: Math.round(potAtRetirement),
    annualDrawdown: Math.round(effectiveAnnualDrawdown),
    monthlyDrawdown: Math.round(effectiveAnnualDrawdown / 12),
    potLastsUntilAge,
    potRunsOut,
    drawdownTimeline,
    drawdownYears,
    yearsToRetirement: Math.round(yearsToRetirement),
    totalContributed: Math.round(monthlyContribution * monthsToRetirement + currentBalance),
    investmentGrowth: Math.round(potAtRetirement - (monthlyContribution * monthsToRetirement + currentBalance)),
    bridgeYearsCovered,
    netAnnualIncome: Math.round(effectiveAnnualDrawdown),
  };
}

/* ─── GIA Calculation Engine ─── */
function calculateGIA(inputs) {
  const {
    currentBalance,
    monthlyContribution,
    annualGrowthRate,
    inflationRate,
    retireAge,
    currentAge,
    planToAge,
    statePensionAge,
    statePensionAnnual,
  } = inputs;

  const realGrowthRate = ((1 + annualGrowthRate / 100) / (1 + inflationRate / 100)) - 1;
  const monthlyRealGrowth = Math.pow(1 + realGrowthRate, 1 / 12) - 1;

  const yearsToRetirement = Math.max(0, retireAge - currentAge);
  const monthsToRetirement = Math.round(yearsToRetirement * 12);

  let potAtRetirement = currentBalance;
  let totalContributed = currentBalance;
  for (let m = 0; m < monthsToRetirement; m++) {
    potAtRetirement = potAtRetirement * (1 + monthlyRealGrowth) + monthlyContribution;
    totalContributed += monthlyContribution;
  }

  const costBasisRatio = potAtRetirement > 0 ? Math.min(1, totalContributed / potAtRetirement) : 1;
  const gainRatio = 1 - costBasisRatio;

  const drawdownYears = Math.max(1, planToAge - retireAge);
  const r = realGrowthRate;

  let annualDrawdown;
  if (Math.abs(r) < 0.0001 || drawdownYears <= 0) {
    annualDrawdown = drawdownYears > 0 ? potAtRetirement / drawdownYears : 0;
  } else {
    annualDrawdown = potAtRetirement * r / (1 - Math.pow(1 + r, -drawdownYears));
  }

  let drawdownPot = potAtRetirement;
  let potLastsUntilAge = retireAge;
  let remainingCostBasis = totalContributed;
  const drawdownTimeline = [];

  for (let age = retireAge; age <= planToAge; age++) {
    const yearStart = drawdownPot;
    const withdrawal = Math.min(annualDrawdown, Math.max(0, drawdownPot));

    const currentGainRatio = yearStart > 0 ? Math.max(0, 1 - (remainingCostBasis / yearStart)) : 0;
    const gainThisWithdrawal = withdrawal * currentGainRatio;
    const costBasisWithdrawn = withdrawal - gainThisWithdrawal;

    drawdownPot = drawdownPot - withdrawal;
    drawdownPot = drawdownPot * (1 + realGrowthRate);
    drawdownPot = Math.max(0, drawdownPot);
    remainingCostBasis = Math.max(0, remainingCostBasis - costBasisWithdrawn);

    drawdownTimeline.push({
      age,
      potStart: yearStart,
      withdrawal,
      taxableGain: gainThisWithdrawal,
      costBasisWithdrawn,
      potEnd: drawdownPot,
    });

    if (drawdownPot <= 0 && withdrawal <= 0) { potLastsUntilAge = age; break; }
    potLastsUntilAge = age;
  }

  const potRunsOut = drawdownPot <= 0 && potLastsUntilAge < planToAge;
  const effectiveAnnualDrawdown = drawdownTimeline.length > 0 ? drawdownTimeline[0].withdrawal : 0;
  const effectiveAnnualGain = drawdownTimeline.length > 0 ? drawdownTimeline[0].taxableGain : 0;

  return {
    potAtRetirement: Math.round(potAtRetirement),
    annualDrawdown: Math.round(effectiveAnnualDrawdown),
    monthlyDrawdown: Math.round(effectiveAnnualDrawdown / 12),
    annualTaxableGain: Math.round(effectiveAnnualGain),
    costBasisRatio,
    gainRatio: 1 - costBasisRatio,
    potLastsUntilAge,
    potRunsOut,
    drawdownTimeline,
    drawdownYears,
    yearsToRetirement: Math.round(yearsToRetirement),
    totalContributed: Math.round(totalContributed),
    investmentGrowth: Math.round(potAtRetirement - totalContributed),
  };
}

/* ─── CGT Calculator ─── */
function calculateCGT(taxableGain, otherTaxableIncome) {
  const cgt = TAX_CONFIG.capitalGainsTax;
  if (!cgt) return { tax: 0, effectiveRate: 0, gainAfterExemption: 0, gainAtBasicRate: 0, gainAtHigherRate: 0 };
  const gainAfterExemption = Math.max(0, taxableGain - cgt.annualExemptAmount);
  if (gainAfterExemption <= 0) return { tax: 0, effectiveRate: 0, gainAfterExemption: 0, gainAtBasicRate: 0, gainAtHigherRate: 0 };

  const basicBandRemaining = Math.max(0, TAX_CONFIG.incomeTax.basicRateThreshold - otherTaxableIncome);
  const gainAtBasicRate = Math.min(gainAfterExemption, basicBandRemaining);
  const gainAtHigherRate = Math.max(0, gainAfterExemption - gainAtBasicRate);

  const tax = Math.round(gainAtBasicRate * cgt.basicRate + gainAtHigherRate * cgt.higherRate);
  const effectiveRate = gainAfterExemption > 0 ? tax / gainAfterExemption : 0;

  return { tax, effectiveRate, gainAfterExemption, gainAtBasicRate, gainAtHigherRate };
}

/* ═══════════════════════════════════════════════════════════════════════
   ─── ACTION PLAN ENGINE ───
   ═══════════════════════════════════════════════════════════════════════ */
function calculateActionPlan({
  annualSalary,
  dcContribYoursPct,
  dcContribEmployerPct,
  dcPotValue,
  dcGrowthRate,
  inflationRate,
  cashIsaBalance,
  cashIsaMonthlyContrib,
  ssIsaBalance,
  ssIsaMonthlyContrib,
  cashIsaGrowthRate,
  ssIsaGrowthRate,
  lumpSumMode,
  targetIncome,
  retireAge,
  planToAge,
  statePensionAge,
  statePensionAnnual,
  currentProjectedNet,
  currentBridgeNet,
  currentAge,
}) {
  const salary = annualSalary;
  const yourPct = dcContribYoursPct;
  const empPct = dcContribEmployerPct;
  const totalPensionPct = yourPct + empPct;
  const gap = targetIncome - currentProjectedNet;
  const hasGap = gap > 0;
  const hasBridgeYears = retireAge < statePensionAge;
  const bridgeYears = hasBridgeYears ? statePensionAge - retireAge : 0;

  const recommendations = [];
  const insights = [];

  // Helper: project forward with modifications
  const projectWithChanges = ({ extraPensionPctYours = 0, extraIsaMonthly = 0, newRetireAge = retireAge }) => {
    const newYourPct = yourPct + extraPensionPctYours;
    const newMonthlySalary = salary / 12;
    const newDcYoursMonthly = newMonthlySalary * (newYourPct / 100);
    const newDcEmployerMonthly = newMonthlySalary * (empPct / 100);

    const dcProj = calculateDCPension({
      currentPotValue: parseFloat(dcPotValue) || 0,
      monthlyContributionYours: newDcYoursMonthly,
      monthlyContributionEmployer: newDcEmployerMonthly,
      annualGrowthRate: parseFloat(dcGrowthRate) || 5,
      inflationRate: parseFloat(inflationRate) || 2,
      retireAge: newRetireAge,
      currentAge,
      lumpSumMode,
      planToAge: parseInt(planToAge) || 90,
      statePensionAge,
      statePensionAnnual,
    });

    const totalIsaMonthlyContrib = (parseFloat(cashIsaMonthlyContrib) || 0) + (parseFloat(ssIsaMonthlyContrib) || 0) + extraIsaMonthly;
    const totalIsaBalance = (parseFloat(cashIsaBalance) || 0) + (parseFloat(ssIsaBalance) || 0);
    const blendedIsaGrowth = (parseFloat(ssIsaGrowthRate) || 7);

    const isaProj = calculateISA({
      currentBalance: totalIsaBalance,
      monthlyContribution: totalIsaMonthlyContrib,
      annualGrowthRate: blendedIsaGrowth,
      inflationRate: parseFloat(inflationRate) || 2,
      retireAge: newRetireAge,
      currentAge,
      planToAge: parseInt(planToAge) || 90,
      statePensionAge,
      statePensionAnnual,
    });

    const dcTaxFree = lumpSumMode === "phased" ? 0.25 : 0;
    const dcTaxableAtSP = dcProj.annualDrawdown * (1 - dcTaxFree) + statePensionAnnual;
    const taxAtSP = calculateIncomeTax(dcTaxableAtSP);
    const netAtSP = dcProj.annualDrawdown + statePensionAnnual - taxAtSP.totalTax + isaProj.annualDrawdown;

    const dcTaxablePreSP = dcProj.annualDrawdown * (1 - dcTaxFree);
    const taxPreSP = calculateIncomeTax(dcTaxablePreSP);
    const netPreSP = dcProj.annualDrawdown - taxPreSP.totalTax + isaProj.annualDrawdown;

    return { netAtSP, netPreSP, dcProj, isaProj };
  };

  // Test retirement ages from current to 75
  let achievableAge = null;
  let earliestViableAge = null;
  for (let testAge = retireAge; testAge <= 75; testAge++) {
    const proj = projectWithChanges({ newRetireAge: testAge });
    if (proj.netAtSP >= targetIncome) {
      if (achievableAge === null) achievableAge = testAge;
    }
    if (proj.netAtSP >= targetIncome * 0.9 && earliestViableAge === null) {
      earliestViableAge = testAge;
    }
  }

  let gapClosed = false;

  // --- Try pension increase first ---
  if (hasGap && salary > 0 && !gapClosed) {
    let bestPensionIncrease = null;
    const maxPensionPct = Math.min(
      100 - yourPct,
      Math.max(0, ((TAX_CONFIG.pensionAllowance.annualAllowance / salary) * 100) - totalPensionPct)
    );

    for (let extraPct = 1; extraPct <= Math.min(maxPensionPct, 30); extraPct++) {
      const proj = projectWithChanges({ extraPensionPctYours: extraPct });
      if (proj.netAtSP >= targetIncome) {
        bestPensionIncrease = extraPct;
        break;
      }
    }

    if (bestPensionIncrease && bestPensionIncrease <= 15) {
      const exactMonthly = (salary / 12) * (bestPensionIncrease / 100);
      const isHigherRate = salary > TAX_CONFIG.incomeTax.basicRateThreshold;
      const isAdditionalRate = salary > TAX_CONFIG.incomeTax.higherRateThreshold;
      const marginalRelief = isAdditionalRate ? 0.45 : isHigherRate ? 0.40 : 0.20;
      const exactCost = exactMonthly * (1 - marginalRelief);
      const reliefLabel = isAdditionalRate ? "additional rate" : isHigherRate ? "higher rate" : "basic rate";
      const proj = projectWithChanges({ extraPensionPctYours: bestPensionIncrease });
      recommendations.push({
        type: "pension_increase",
        priority: 1,
        title: `Increase pension contribution by ${bestPensionIncrease}%`,
        subtitle: `From ${yourPct}% to ${yourPct + bestPensionIncrease}% of salary`,
        description: `Increasing your pension contribution by ${bestPensionIncrease} percentage points would close the gap. This adds ${formatCurrency(Math.round(exactMonthly))}/month to your pension pot, but with ${reliefLabel} tax relief (${(marginalRelief * 100).toFixed(0)}%) it only costs you around ${formatCurrency(Math.round(exactCost))}/month in take-home pay${isHigherRate ? " — making pension contributions particularly effective at your income level" : ""}.`,
        impact: proj.netAtSP - currentProjectedNet,
        impactTotal: proj.netAtSP,
        monthlyCost: Math.round(exactCost),
        closesGap: true,
        icon: "📈",
        color: C.cyan,
      });
      gapClosed = true;
    }
  }

  // --- Try ISA increase ---
  if (hasGap && !gapClosed) {
    const currentIsaMonthly = (parseFloat(cashIsaMonthlyContrib) || 0) + (parseFloat(ssIsaMonthlyContrib) || 0);
    const maxIsaMonthly = TAX_CONFIG.isaAllowance.annualAllowance / 12;
    const remainingIsaMonthly = Math.max(0, maxIsaMonthly - currentIsaMonthly);

    if (remainingIsaMonthly > 50) {
      let bestIsaIncrease = null;
      for (let extra = 100; extra <= remainingIsaMonthly; extra += 100) {
        const proj = projectWithChanges({ extraIsaMonthly: extra });
        if (proj.netAtSP >= targetIncome) {
          bestIsaIncrease = extra;
          break;
        }
      }

      if (bestIsaIncrease) {
        const proj = projectWithChanges({ extraIsaMonthly: bestIsaIncrease });
        recommendations.push({
          type: "isa_increase",
          priority: 2,
          title: `Add ${formatCurrency(bestIsaIncrease)}/month to your ISA`,
          subtitle: `Invested in a Stocks & Shares ISA for long-term growth`,
          description: `Adding ${formatCurrency(bestIsaIncrease)}/month to your ISA would close the gap. ISA withdrawals are completely tax-free, and unlike pensions there's no age restriction — making them especially valuable${hasBridgeYears ? " for your bridge years before State Pension" : ""}.`,
          impact: proj.netAtSP - currentProjectedNet,
          impactTotal: proj.netAtSP,
          monthlyCost: bestIsaIncrease,
          closesGap: true,
          icon: "🛡️",
          color: C.violet,
        });
        gapClosed = true;
      }
    }
  }

  // --- Try combined pension + ISA ---
  if (hasGap && !gapClosed) {
    const maxPensionPct = Math.min(
      15,
      Math.max(0, ((TAX_CONFIG.pensionAllowance.annualAllowance / (salary || 1)) * 100) - totalPensionPct)
    );
    const currentIsaMonthly = (parseFloat(cashIsaMonthlyContrib) || 0) + (parseFloat(ssIsaMonthlyContrib) || 0);
    const maxIsaExtra = Math.max(0, (TAX_CONFIG.isaAllowance.annualAllowance / 12) - currentIsaMonthly);

    let bestCombo = null;
    outer: for (let extraPct = 1; extraPct <= maxPensionPct; extraPct++) {
      for (let extraIsa = 0; extraIsa <= maxIsaExtra; extraIsa += 100) {
        const proj = projectWithChanges({ extraPensionPctYours: extraPct, extraIsaMonthly: extraIsa });
        if (proj.netAtSP >= targetIncome) {
          bestCombo = { extraPct, extraIsa, proj };
          break outer;
        }
      }
    }

    if (bestCombo) {
      const comboPensionMonthly = (salary / 12) * (bestCombo.extraPct / 100);
      const isHR = salary > TAX_CONFIG.incomeTax.basicRateThreshold;
      const isAR = salary > TAX_CONFIG.incomeTax.higherRateThreshold;
      const mRelief = isAR ? 0.45 : isHR ? 0.40 : 0.20;
      const comboPensionCost = comboPensionMonthly * (1 - mRelief);
      const totalMonthlyCost = Math.round(comboPensionCost + bestCombo.extraIsa);

      recommendations.push({
        type: "combined",
        priority: 3,
        title: "Combined pension and ISA increase",
        subtitle: `Pension +${bestCombo.extraPct}% and ISA +${formatCurrency(bestCombo.extraIsa)}/month`,
        description: `Combining a ${bestCombo.extraPct} percentage point pension increase (costing ~${formatCurrency(Math.round(comboPensionCost))}/month after tax relief) with an extra ${formatCurrency(bestCombo.extraIsa)}/month into your ISA would close the gap. Total additional monthly cost: approximately ${formatCurrency(totalMonthlyCost)}.`,
        impact: bestCombo.proj.netAtSP - currentProjectedNet,
        impactTotal: bestCombo.proj.netAtSP,
        monthlyCost: totalMonthlyCost,
        closesGap: true,
        icon: "🎯",
        color: C.green,
        comboPensionPct: bestCombo.extraPct,
        comboIsaMonthly: bestCombo.extraIsa,
      });
      gapClosed = true;
    }
  }

  // --- Retirement age as primary ---
  if (hasGap && !gapClosed && achievableAge && achievableAge !== retireAge) {
    const ageProj = projectWithChanges({ newRetireAge: achievableAge });
    const yearsDiff = achievableAge - retireAge;

    recommendations.push({
      type: "retire_age",
      priority: 4,
      title: `Retire at ${achievableAge} instead of ${retireAge}`,
      subtitle: `${yearsDiff} year${yearsDiff !== 1 ? "s" : ""} later — no contribution changes needed`,
      description: `With current contributions, retiring at ${achievableAge} instead of ${retireAge} would meet your target of ${formatCurrency(targetIncome)}/year. Each year you work longer means one more year of contributions, one fewer year of drawdown, and a bigger pot.`,
      impact: ageProj.netAtSP - currentProjectedNet,
      impactTotal: ageProj.netAtSP,
      monthlyCost: 0,
      closesGap: true,
      icon: "📅",
      color: C.blue,
      newAge: achievableAge,
    });

    if (salary > 0) {
      const reasonablePensionIncrease = Math.min(5, Math.max(0, ((TAX_CONFIG.pensionAllowance.annualAllowance / salary) * 100) - totalPensionPct));
      if (reasonablePensionIncrease >= 1) {
        const partialProj = projectWithChanges({ extraPensionPctYours: reasonablePensionIncrease });
        const partialMonthly = (salary / 12) * (reasonablePensionIncrease / 100);
        const isHR = salary > TAX_CONFIG.incomeTax.basicRateThreshold;
        const isAR = salary > TAX_CONFIG.incomeTax.higherRateThreshold;
        const mRelief = isAR ? 0.45 : isHR ? 0.40 : 0.20;
        const partialCost = partialMonthly * (1 - mRelief);
        recommendations.push({
          type: "pension_partial",
          priority: 5,
          title: `Or: increase pension by ${reasonablePensionIncrease}% to reduce the gap`,
          subtitle: `From ${yourPct}% to ${yourPct + reasonablePensionIncrease}% of salary`,
          description: `This wouldn't fully close the gap on its own, but adding ${reasonablePensionIncrease} percentage points to your pension (costing ~${formatCurrency(Math.round(partialCost))}/month after tax relief) combined with a smaller retirement age adjustment could get you there.`,
          impact: partialProj.netAtSP - currentProjectedNet,
          impactTotal: partialProj.netAtSP,
          monthlyCost: Math.round(partialCost),
          closesGap: false,
          icon: "📈",
          color: C.cyan,
        });
      }
    }
  }

  // --- Nothing works ---
  if (hasGap && !gapClosed && !achievableAge) {
    recommendations.push({
      type: "target_review",
      priority: 1,
      title: "Consider adjusting your target",
      subtitle: `Current projection: ${formatCurrency(Math.round(currentProjectedNet))}/year net`,
      description: `Based on your current savings and contribution capacity, reaching ${formatCurrency(targetIncome)}/year net income appears very challenging even with maximum contributions and a later retirement age. You might consider a lower income target, or speak with a financial adviser about other strategies.`,
      impact: 0,
      impactTotal: currentProjectedNet,
      monthlyCost: 0,
      closesGap: false,
      icon: "🔄",
      color: C.amber,
    });
  }

  // --- Already on track ---
  if (!hasGap) {
    const surplus = currentProjectedNet - targetIncome;
    insights.push({
      type: "on_track",
      priority: 0,
      title: "You're on track",
      description: `Your projected net income of ${formatCurrency(Math.round(currentProjectedNet))}/year exceeds your target by ${formatCurrency(Math.round(surplus))}/year. This surplus gives you a buffer for unexpected costs, or you could consider retiring earlier, targeting a higher income, or simply enjoying the peace of mind.`,
      icon: "✓",
      color: C.green,
    });
  }

  // --- Tax efficiency insight ---
  if (salary > TAX_CONFIG.incomeTax.basicRateThreshold) {
    insights.push({
      type: "higher_rate_relief",
      priority: 2,
      title: "Higher-rate tax relief on pension contributions",
      description: `With a salary of ${formatCurrency(Math.round(salary))}, you're a higher-rate taxpayer. Every pound you put into your pension via salary sacrifice saves you 40% income tax plus National Insurance — effectively costing you around 58p per £1 invested. This makes pension contributions particularly valuable at your income level.`,
      icon: "💡",
      color: C.amber,
    });
  }

  // Bridge years insight
  if (hasBridgeYears) {
    insights.push({
      type: "bridge_years",
      priority: 3,
      title: `${bridgeYears} bridge years to plan for`,
      description: `You want to retire at ${retireAge} but your State Pension doesn't start until ${statePensionAge}. During these ${bridgeYears} years, your income comes entirely from DC pension drawdown and ISA withdrawals. ISAs are especially valuable here — they're tax-free and accessible from any age, unlike pensions which are locked until 57/58.`,
      icon: "🌉",
      color: C.violet,
    });
  }

  // Pension annual allowance warning
  const totalAnnualPensionContrib = salary * (totalPensionPct / 100);
  if (totalAnnualPensionContrib > TAX_CONFIG.pensionAllowance.annualAllowance * 0.8) {
    insights.push({
      type: "aa_warning",
      priority: 1,
      title: "Approaching pension annual allowance",
      description: `Your total pension contributions (yours + employer) are ${formatCurrency(Math.round(totalAnnualPensionContrib))}/year. The pension annual allowance is ${formatCurrency(TAX_CONFIG.pensionAllowance.annualAllowance)}/year for 2025/26. Contributions above this trigger a tax charge, so check with your pension provider before increasing further.`,
      icon: "⚠️",
      color: C.red,
    });
  }

  recommendations.sort((a, b) => a.priority - b.priority);
  insights.sort((a, b) => a.priority - b.priority);

  return {
    gap: Math.round(gap),
    hasGap,
    targetIncome,
    projectedNet: Math.round(currentProjectedNet),
    bridgeNet: Math.round(currentBridgeNet),
    recommendations,
    insights,
    achievableAge,
    earliestViableAge,
    retireAge,
    statePensionAge,
    bridgeYears,
  };
}

/* ─── Scroll-triggered animation hook ─── */
function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function Reveal({ children, delay = 0, direction = "up", scale = false, blur = false, style = {} }) {
  const [ref, visible] = useScrollReveal(0.1);
  const transforms = {
    up: "translateY(30px)", down: "translateY(-30px)",
    left: "translateX(-40px)", right: "translateX(40px)", none: "translate(0)",
  };
  const startTransform = [transforms[direction] || transforms.up, scale ? "scale(0.97)" : ""].filter(Boolean).join(" ");
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translate(0) scale(1)" : startTransform,
      filter: blur ? (visible ? "blur(0px)" : "blur(4px)") : "none",
      transition: [
        `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
        `transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
        blur ? `filter 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s` : "",
      ].filter(Boolean).join(", "),
      willChange: "opacity, transform", ...style,
    }}>{children}</div>
  );
}

/* ─── CountUp animation ─── */
function CountUp({ target, prefix = "", suffix = "", duration = 1200, decimals = 0 }) {
  const [ref, visible] = useScrollReveal(0.3);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(target * ease);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [visible, target, duration]);
  const display = decimals > 0
    ? val.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(val).toLocaleString("en-GB");
  return <span ref={ref}>{prefix}{display}{suffix}</span>;
}

/* ─── Divider — clean, minimal ─── */
function Divider({ texture = "gradient" }) {
  const [ref, visible] = useScrollReveal(0.5);
  return (
    <div ref={ref} style={{
      height: 1, margin: "48px 0",
      background: `linear-gradient(90deg, transparent, ${C.border}, transparent)`,
      opacity: visible ? 1 : 0, transition: "opacity 0.8s ease",
    }} />
  );
}

/* ─── Tooltip ─── */
function Tip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 6 }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${C.textDim}`,
          fontSize: 10, color: C.textSoft, cursor: "help",
          fontWeight: 600,
        }}
      >?</span>
      {show && (
        <div style={{
          position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", width: 300,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: "16px 20px", fontSize: 13, color: C.textSoft, lineHeight: 1.6,
          zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
        }}>{text}</div>
      )}
    </span>
  );
}

/* ─── Section label ─── */
function SectionLabel({ step, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <div style={{
        fontSize: 12, color: C.pink, textTransform: "uppercase",
        letterSpacing: "0.1em", fontWeight: 600, whiteSpace: "nowrap",
      }}>{text}</div>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${C.pink}30, transparent)` }} />
      {step !== undefined && (
        <div style={{
          fontSize: 10, color: C.textDim,
          border: `1px solid ${C.border}`, borderRadius: 20, padding: "2px 10px",
        }}>{step}</div>
      )}
    </div>
  );
}

/* ─── Step dots ─── */
function StepDots({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i <= current ? 32 : 8, height: 8, borderRadius: 4,
          background: i <= current ? C.cyan : C.border,
          transition: "all 0.5s cubic-bezier(0.16,1,0.3,1)",
        }} />
      ))}
    </div>
  );
}

/* ─── Input components — clean, light ─── */
function Field({ label, tip, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <label style={{
        display: "flex", alignItems: "center", fontSize: 13, color: C.textSoft,
        marginBottom: 8, fontWeight: 600,
        letterSpacing: "0.02em",
      }}>{label}{tip && <Tip text={tip} />}</label>
      {children}
    </div>
  );
}

function TextInput({ type = "text", value, onChange, prefix, suffix, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      {prefix && (
        <span style={{
          position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
          color: C.textDim, fontSize: 16, fontWeight: 500, pointerEvents: "none",
        }}>{prefix}</span>
      )}
      <input
        type={type} value={value} onChange={onChange}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: "100%", padding: "14px 16px", background: C.bgAlt,
          border: `2px solid ${focused ? C.pink : C.border}`,
          borderRadius: 12, color: C.text, fontSize: 16, outline: "none",
          boxSizing: "border-box", transition: "border-color 0.3s, box-shadow 0.3s",
          boxShadow: focused ? `0 0 0 3px ${C.pinkGlow}` : "none",
          fontFamily: "inherit",
          paddingLeft: prefix ? 34 : 16,
          paddingRight: suffix ? 80 : 16,
          ...props.style,
        }}
        {...props}
      />
      {suffix && (
        <span style={{
          position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
          color: C.textDim, fontSize: 14,
        }}>{suffix}</span>
      )}
    </div>
  );
}

/* ─── Currency input with comma formatting ─── */
function CurrencyInput({ value, onValueChange, prefix = "£", suffix, ...props }) {
  const [focused, setFocused] = useState(false);
  const [localVal, setLocalVal] = useState("");

  const addCommas = (str) => {
    const parts = str.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  const displayValue = focused ? localVal : addCommas(value || "");

  const handleFocus = () => { setFocused(true); setLocalVal(value || ""); };
  const handleBlur = () => { setFocused(false); };
  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    setLocalVal(raw);
    onValueChange(raw);
  };

  return (
    <div style={{ position: "relative" }}>
      {prefix && (
        <span style={{
          position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
          color: C.textDim, fontSize: 16, fontWeight: 500, pointerEvents: "none",
        }}>{prefix}</span>
      )}
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{
          width: "100%", padding: "14px 16px", background: C.bgAlt,
          border: `2px solid ${focused ? C.pink : C.border}`,
          borderRadius: 12, color: C.text, fontSize: 16, outline: "none",
          boxSizing: "border-box", transition: "border-color 0.3s, box-shadow 0.3s",
          boxShadow: focused ? `0 0 0 3px ${C.pinkGlow}` : "none",
          fontFamily: "inherit",
          paddingLeft: prefix ? 34 : 16,
          paddingRight: suffix ? 80 : 16,
          ...props.style,
        }}
        {...props}
      />
      {suffix && (
        <span style={{
          position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
          color: C.textDim, fontSize: 14,
        }}>{suffix}</span>
      )}
    </div>
  );
}

/* ─── Background — clean, warm, minimal ─── */
function Background() {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: C.bg }} />
      <div style={{ position: "absolute", top: "-5%", right: "-10%", width: 600, height: 600, borderRadius: "50%", background: C.pink, opacity: 0.04, filter: "blur(140px)" }} />
      <div style={{ position: "absolute", bottom: "10%", left: "-5%", width: 500, height: 500, borderRadius: "50%", background: C.chartBlue, opacity: 0.035, filter: "blur(120px)" }} />
      <div style={{ position: "absolute", top: "40%", left: "50%", width: 400, height: 400, borderRadius: "50%", background: C.chartYellow, opacity: 0.03, filter: "blur(100px)" }} />
    </div>
  );
}

/* ─── Paper Texture Circle — Octopus Money collage style ─── */
/* Creates an SVG circle with procedural "crumpled paper" texture using
   layered fractal noise filters. Positioned absolutely to peek out from 
   behind content sections, giving a handmade collage feel. */
function PaperCircle({ size = 200, top, bottom, left, right, opacity = 0.55, color = "#bde4f4", seed = 1 }) {
  const id = `paper-${seed}`;
  
  // Generate an irregular blob path using seeded pseudo-random wobble
  // This makes each circle unique and hand-drawn looking
  const points = 12;
  const cx = 100, cy = 100, baseR = 88;
  // Simple seeded pseudo-random
  const rand = (i) => {
    const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  
  // Generate wobbly radius points
  const radii = [];
  for (let i = 0; i < points; i++) {
    const wobble = baseR + (rand(i) - 0.5) * 28; // ±14px wobble
    radii.push(Math.max(70, Math.min(96, wobble)));
  }
  
  // Build smooth blob path using cubic beziers
  const getPoint = (i) => {
    const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
    const r = radii[i % points];
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };
  
  let d = "";
  for (let i = 0; i < points; i++) {
    const curr = getPoint(i);
    const next = getPoint((i + 1) % points);
    const midAngle = ((i + 0.5) / points) * Math.PI * 2 - Math.PI / 2;
    const nextMidAngle = ((i + 1.5) / points) * Math.PI * 2 - Math.PI / 2;
    const cR = radii[i] * 0.55;
    const nR = radii[(i + 1) % points] * 0.55;
    
    if (i === 0) d += `M ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} `;
    
    const cp1x = curr.x + Math.cos(midAngle + Math.PI / 2) * cR * (0.4 + rand(i + 50) * 0.2);
    const cp1y = curr.y + Math.sin(midAngle + Math.PI / 2) * cR * (0.4 + rand(i + 60) * 0.2);
    const cp2x = next.x - Math.cos(nextMidAngle + Math.PI / 2) * nR * (0.4 + rand(i + 70) * 0.2);
    const cp2y = next.y - Math.sin(nextMidAngle + Math.PI / 2) * nR * (0.4 + rand(i + 80) * 0.2);
    
    d += `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)} `;
  }
  d += "Z";
  
  return (
    <div style={{
      position: "absolute",
      top: top !== undefined ? top : "auto",
      bottom: bottom !== undefined ? bottom : "auto",
      left: left !== undefined ? left : "auto",
      right: right !== undefined ? right : "auto",
      width: size, height: size,
      pointerEvents: "none",
      zIndex: 0,
      opacity,
    }}>
      <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Crumpled paper texture — visible wrinkle pattern */}
          <filter id={`${id}-tex`} x="-10%" y="-10%" width="120%" height="120%">
            {/* Large fold/wrinkle pattern */}
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed={seed} result="wrinkles" />
            {/* Fine paper grain */}
            <feTurbulence type="turbulence" baseFrequency="0.5" numOctaves="3" seed={seed + 50} result="grain" />
            {/* Light and shadow from wrinkles */}
            <feDiffuseLighting in="wrinkles" lightingColor="#ffffff" surfaceScale="3" result="light">
              <feDistantLight azimuth="135" elevation="50" />
            </feDiffuseLighting>
            {/* Composite: apply lighting onto the base shape */}
            <feComposite in="light" in2="SourceGraphic" operator="in" result="lit" />
            {/* Blend the lit texture with original for visible crumple effect */}
            <feBlend in="lit" in2="SourceGraphic" mode="overlay" result="textured" />
            {/* Add grain on top */}
            <feComposite in="grain" in2="textured" operator="in" result="grained" />
            <feBlend in="grained" in2="textured" mode="soft-light" />
          </filter>
          <clipPath id={`${id}-clip`}>
            <path d={d} />
          </clipPath>
        </defs>
        {/* Solid base colour — the main visible fill */}
        <path d={d} fill={color} />
        {/* Paper texture overlay — wrinkle lighting effect */}
        <path d={d} fill={color} filter={`url(#${id}-tex)`} opacity="0.85" />
        {/* Darker edge/shadow to add depth */}
        <path d={d} fill="none" stroke={color} strokeWidth="3" opacity="0.4"
          style={{ filter: "blur(3px)" }} clipPath={`url(#${id}-clip)`} />
        {/* Inner highlight for paper-like sheen */}
        <ellipse cx={cx - 15 + rand(99) * 30} cy={cy - 20 + rand(98) * 20} rx="35" ry="28"
          fill="#ffffff" opacity="0.15" clipPath={`url(#${id}-clip)`} />
      </svg>
    </div>
  );
}

/* ─── Tab component — rounded pill style ─── */
function TabBar({ activeTab, onTabChange }) {
  const tabs = [
    { id: "plan", label: "My Plan", icon: "01", available: true },
    { id: "trajectory", label: "My Trajectory", icon: "02", available: true },
    { id: "actions", label: "Action Plan", icon: "03", available: true },
  ];
  return (
    <div style={{
      display: "flex", gap: 4, padding: "4px", background: C.bgAlt,
      borderRadius: 16, border: `1px solid ${C.border}`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      {tabs.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => tab.available && onTabChange(tab.id)}
            style={{
              flex: 1, padding: "10px 16px", borderRadius: 12,
              border: "none", position: "relative", overflow: "hidden",
              background: active ? C.pink : "transparent",
              color: active ? "#ffffff" : tab.available ? C.textSoft : C.textDim,
              fontSize: 13, fontFamily: "inherit",
              fontWeight: active ? 600 : 500,
              cursor: tab.available ? "pointer" : "default",
              transition: "all 0.3s ease",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <span style={{ fontSize: 10, opacity: active ? 0.7 : 0.4, fontWeight: 600 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── State Pension Result Card ─── */
function StatePensionResult({ result }) {
  if (!result || result.annualAmount === 0) return null;

  const qualifyingBar = Math.min(result.totalQualifyingYears / 35 * 100, 100);
  const currentBar = Math.min(result.qualifyingYearsCurrent / 35 * 100, 100);

  return (
    <Reveal delay={0.15} scale blur>
      <div style={{
        background: C.blueLight,
        border: `1px solid ${C.blue}20`, borderRadius: 16,
        padding: "28px 28px", marginTop: 16, position: "relative", overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{
                fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em",
                fontWeight: 600, marginBottom: 10,
              }}>Annual State Pension</div>
              <div style={{
                fontSize: 40, fontWeight: 700,
                color: C.blue, letterSpacing: "-0.03em",
              }}>
                £<CountUp target={Math.round(result.annualAmount)} />
              </div>
              <div style={{ fontSize: 13, color: C.textDim, marginTop: 8 }}>
                {formatCurrency(result.weeklyAmount, 2)}/week · {formatCurrency(result.monthlyAmount, 2)}/month
              </div>
            </div>
            <div style={{
              background: result.onTrackForFull ? C.greenLight : C.violetLight,
              border: `1px solid ${result.onTrackForFull ? C.green + "30" : C.violet + "30"}`,
              borderRadius: 20, padding: "6px 14px", fontSize: 12,
              color: result.onTrackForFull ? C.green : C.violet,
              fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: result.onTrackForFull ? C.green : C.violet }} />
              {result.onTrackForFull ? "On track for full pension" : "Partial pension"}
            </div>
          </div>

          {/* Detail row */}
          <div style={{
            display: "flex", gap: 24, marginTop: 20, paddingTop: 18,
            borderTop: `1px solid ${C.blue}15`, flexWrap: "wrap",
          }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                From age
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
                {result.statePensionAge}
              </div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                {formatDate(result.statePensionDate)}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Qualifying Years
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
                {result.qualifyingYearsCurrent} <span style={{ color: C.textDim, fontWeight: 400, fontSize: 14 }}>of {result.totalQualifyingYears} projected</span>
              </div>
              {/* Progress bar */}
              <div style={{ marginTop: 8, height: 8, background: `${C.blue}10`, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, height: "100%", width: `${qualifyingBar}%`,
                  background: `${C.blue}25`,
                  borderRadius: 4, transition: "width 0.6s ease",
                }} />
                <div style={{
                  position: "absolute", top: 0, left: 0, height: "100%", width: `${currentBar}%`,
                  background: C.blue,
                  borderRadius: 4, transition: "width 0.6s ease",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 11, color: C.textDim }}>
                  {result.qualifyingYearsCurrent} built up
                </span>
                <span style={{ fontSize: 11, color: C.textDim }}>
                  35 for full
                </span>
              </div>
            </div>
          </div>

          {/* Source note */}
          {result.usedForecast && (
            <div style={{
              marginTop: 18, padding: "12px 16px", background: `${C.blue}08`,
              border: `1px solid ${C.blue}15`, borderRadius: 10,
              fontSize: 12, color: C.textDim, lineHeight: 1.6,
            }}>
              Based on your GOV.UK forecast of {formatCurrency(result.weeklyAmount, 2)}/week at {TAX_CONFIG.year} rates.
              The actual amount at retirement will be higher due to the Triple Lock (annual increases by the highest of inflation, earnings growth, or 2.5%).
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}

/* ─── Educational expandable — clean card style ─── */
function LearnMore({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      marginTop: 16, border: `1px solid ${C.border}`, borderRadius: 14,
      overflow: "hidden", transition: "all 0.3s ease",
      background: C.bgAlt,
      boxShadow: open ? "0 2px 12px rgba(0,0,0,0.04)" : "none",
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", background: "transparent", border: "none", cursor: "pointer",
          color: C.textSoft, fontSize: 13, fontFamily: "inherit", fontWeight: 500,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: C.pink, fontSize: 14, fontWeight: 700 }}>?</span>
          {title}
        </span>
        <span style={{
          color: C.textDim, transform: open ? "rotate(180deg)" : "rotate(0)",
          transition: "transform 0.3s ease", fontSize: 12,
        }}>▼</span>
      </button>
      {open && (
        <div style={{
          padding: "16px 18px", background: C.bg,
          fontSize: 14, color: C.textSoft, lineHeight: 1.7,
          borderTop: `1px solid ${C.border}`,
        }}>{children}</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/* ─── TAX BREAKDOWN PANEL ─── */
/* ═══════════════════════════════════════════════════ */
function TaxBreakdownPanel({ preSPTax, postSPTax, isaIncome, statePensionAnnual, retireAge, statePensionAge, paRemainingAfterSP, lumpSumMode, hasBridgeYears, giaDrawdown, giaTaxableGain, preSPGiaDrawdown, preSPGiaTaxableGain }) {
  const [phase, setPhase] = useState("post");
  const tax = phase === "pre" && hasBridgeYears ? preSPTax : postSPTax;
  const currentGiaDrawdown = phase === "pre" && hasBridgeYears ? (preSPGiaDrawdown || 0) : (giaDrawdown || 0);
  const currentGiaGain = phase === "pre" && hasBridgeYears ? (preSPGiaTaxableGain || 0) : (giaTaxableGain || 0);

  const cgtResult = calculateCGT(currentGiaGain, tax.grossIncome);
  const totalTaxBurden = tax.totalTax + cgtResult.tax;

  const totalForBar = tax.grossIncome > 0 ? tax.grossIncome : 1;

  const taxFreePortion = lumpSumMode === "phased" ? "25% of each withdrawal" : lumpSumMode === "upfront" ? "taken upfront" : "not taken";

  return (
    <div style={{
      marginTop: 24, background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 16, padding: "28px 28px", position: "relative", overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
    }}>
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, color: C.text }}>Tax Breakdown</div>
            <div style={{ fontSize: 13, color: C.textDim }}>
              How your retirement income is taxed · {TAX_CONFIG.year} HMRC rates
            </div>
          </div>
          {hasBridgeYears && (
          <div style={{ display: "flex", gap: 2, background: C.bg, borderRadius: 10, padding: 3, border: `1px solid ${C.border}` }}>
            {[
              { id: "pre", label: `Before SP (${retireAge}–${statePensionAge - 1})` },
              { id: "post", label: `After SP (${statePensionAge}+)` },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPhase(p.id)}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "none",
                  background: phase === p.id ? C.card : "transparent",
                  color: phase === p.id ? C.pink : C.textDim,
                  fontSize: 12, fontWeight: phase === p.id ? 600 : 400,
                  cursor: "pointer", transition: "all 0.3s ease",
                  boxShadow: phase === p.id ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                }}
              >{p.label}</button>
            ))}
          </div>
          )}
        </div>

        {/* Income sources breakdown */}
        <div style={{
          padding: "16px 18px", background: C.bg, borderRadius: 12,
          border: `1px solid ${C.border}`, marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Income Sources
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {phase === "post" && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: C.chartBlue }} />
                  <span style={{ fontSize: 13, color: C.textSoft }}>State Pension</span>
                  <span style={{
                    fontSize: 10, padding: "2px 6px", background: C.redLight, border: `1px solid ${C.red}20`,
                    borderRadius: 4, color: C.red, fontWeight: 600,
                  }}>taxable</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                  {formatCurrency(statePensionAnnual)}
                </span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: C.chartCoral }} />
                <span style={{ fontSize: 13, color: C.textSoft }}>DC Pension (taxable portion)</span>
                <span style={{
                  fontSize: 10, padding: "2px 6px", background: C.redLight, border: `1px solid ${C.red}20`,
                  borderRadius: 4, color: C.red, fontWeight: 600,
                }}>taxable</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {formatCurrency(tax.grossIncome - (phase === "post" ? statePensionAnnual : 0))}
              </span>
            </div>
            {lumpSumMode === "phased" && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: C.green }} />
                  <span style={{ fontSize: 13, color: C.textSoft }}>DC Pension (25% tax-free)</span>
                  <span style={{
                    fontSize: 10, padding: "2px 6px", background: C.greenLight, border: `1px solid ${C.green}20`,
                    borderRadius: 4, color: C.green, fontWeight: 600,
                  }}>tax-free</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.green }}>
                  {formatCurrency(Math.round((tax.grossIncome - (phase === "post" ? statePensionAnnual : 0)) / 3))}
                </span>
              </div>
            )}
            {isaIncome > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: C.chartYellow }} />
                  <span style={{ fontSize: 13, color: C.textSoft }}>ISA Withdrawals</span>
                  <span style={{
                    fontSize: 10, padding: "2px 6px", background: C.greenLight, border: `1px solid ${C.green}20`,
                    borderRadius: 4, color: C.green, fontWeight: 600,
                  }}>tax-free</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.green }}>
                  {formatCurrency(isaIncome)}
                </span>
              </div>
            )}
            {currentGiaDrawdown > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: C.chartAmber }} />
                  <span style={{ fontSize: 13, color: C.textSoft }}>GIA Withdrawals</span>
                  <span style={{
                    fontSize: 10, padding: "2px 6px", background: C.amberLight, border: `1px solid ${C.amber}20`,
                    borderRadius: 4, color: C.amber, fontWeight: 600,
                  }}>CGT on gains</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                  {formatCurrency(currentGiaDrawdown)}<span style={{ fontSize: 11, color: C.textDim, fontWeight: 400 }}> ({formatCurrency(Math.round(currentGiaGain))} gain)</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tax band bars */}
        {tax.bands && tax.bands.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Income Tax Bands
            </div>
            <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", height: 20, background: C.bg }}>
              {tax.bands.map((band, i) => (
                <div key={i} style={{
                  width: `${(band.amount / totalForBar) * 100}%`, height: "100%",
                  background: band.color,
                  minWidth: band.amount > 0 ? 2 : 0,
                  transition: "width 0.5s ease",
                }} title={`${band.name}: ${formatCurrency(band.amount)} @ ${(band.rate * 100).toFixed(0)}% = ${formatCurrency(band.tax)} tax`} />
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
              {tax.bands.map((band, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: band.color }} />
                  <span style={{ color: C.text }}>
                    {band.name} ({(band.rate * 100).toFixed(0)}%): {formatCurrency(band.amount)} → {formatCurrency(band.tax)} tax
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary line — four key figures */}
        <div style={{
          padding: "16px 18px", background: C.bg, borderRadius: 12,
          border: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 6 }}>Income Tax</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.red }}>
              −{formatCurrency(tax.totalTax)}
            </div>
            {cgtResult.tax > 0 && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>+ {formatCurrency(cgtResult.tax)} CGT</div>}
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 6 }}>Effective Rate</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
              {(tax.effectiveRate * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 6 }}>
              Marginal Rate <Tip text="The tax rate you'd pay on the next £1 of income. In the £100k–£125,140 band this can be 60% due to the Personal Allowance taper." />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
              {(tax.marginalRate * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 6 }}>Net Income</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>
              {formatCurrency(tax.netIncome + (isaIncome || 0) + (currentGiaDrawdown - cgtResult.tax))}
            </div>
          </div>
        </div>

        {/* PA taper warning */}
        {tax.isPATapered && (
          <div style={{
            marginTop: 16, padding: "14px 18px",
            background: C.redLight, border: `1px solid ${C.red}20`,
            borderRadius: 12, fontSize: 13, color: C.textSoft, lineHeight: 1.65,
          }}>
            <strong style={{ color: C.red }}>The 60% tax trap:</strong>{" "}
            Your taxable income is in the £100,000–£125,140 band where your Personal Allowance is being withdrawn.
            Your standard allowance of £{TAX_CONFIG.incomeTax.personalAllowance.toLocaleString("en-GB")} has been reduced
            by {formatCurrency(tax.taperReduction)} to {formatCurrency(tax.personalAllowance)}.
            Each additional £1 of pension income in this band costs you 60p in tax.
            <strong style={{ color: C.cyan }}> Strategy: </strong>
            If you can control how much pension income you take (which you can with drawdown), aim to keep taxable income
            below £100,000. Use ISA savings for anything above that — they're invisible to the taxman.
          </div>
        )}

        {/* General PA insight for post-SP phase */}
        {phase === "post" && !tax.isPATapered && (
          <div style={{
            marginTop: 16, padding: "14px 18px",
            background: C.blueLight, border: `1px solid ${C.blue}15`,
            borderRadius: 12, fontSize: 13, color: C.textSoft, lineHeight: 1.65,
          }}>
            <strong style={{ color: C.blue }}>How your Personal Allowance is being used:</strong>{" "}
            Your State Pension of {formatCurrency(statePensionAnnual)}/year is fully taxable (HMRC treats it as income, even though no tax is deducted at source).
            It uses {formatCurrency(Math.min(statePensionAnnual, TAX_CONFIG.incomeTax.personalAllowance))} of your
            £{TAX_CONFIG.incomeTax.personalAllowance.toLocaleString("en-GB")} Personal Allowance,
            leaving {formatCurrency(paRemainingAfterSP)} tax-free for other income.
            {paRemainingAfterSP < 1000 && (
              <span style={{ color: C.amber }}>
                {" "}That means almost every pound of DC pension drawdown is taxed at {(TAX_CONFIG.incomeTax.basicRate * 100).toFixed(0)}% or more.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/* ─── MAIN APP ─── */
/* ═══════════════════════════════════════════════════ */
export default function RetirePlanner() {
  const [activeTab, setActiveTab] = useState("plan");
  const [scrollY, setScrollY] = useState(0);
  const [chartMode, setChartMode] = useState("net");
  const [chartTooltip, setChartTooltip] = useState(null);

  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [loadMessage, setLoadMessage] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef(null);

  const [reviewData, setReviewData] = useState(null);

  const [taxConfig, setTaxConfig] = useState(() => JSON.parse(JSON.stringify(DEFAULT_TAX_CONFIG)));
  TAX_CONFIG = taxConfig;

  // ─── Form state ───
  const [dob, setDob] = useState("1994-02-08");
  const [statePensionAge, setStatePensionAge] = useState(67);
  const [retireAge, setRetireAge] = useState(60);
  const [targetIncome, setTargetIncome] = useState("25000");
  const [qualifyingYears, setQualifyingYears] = useState(12);
  const [weeklyForecast, setWeeklyForecast] = useState("230.25");

  const [householdType, setHouseholdType] = useState("one");
  const [planToAge, setPlanToAge] = useState("90");

  const [dcPotValue, setDcPotValue] = useState("45000");
  const [annualSalary, setAnnualSalary] = useState("50000");
  const [dcContribYoursPct, setDcContribYoursPct] = useState("5");
  const [dcContribEmployerPct, setDcContribEmployerPct] = useState("3");
  const [dcGrowthRate, setDcGrowthRate] = useState("5");
  const [inflationRate, setInflationRate] = useState("2");
  const [lumpSumMode, setLumpSumMode] = useState("phased");

  const [cashIsaBalance, setCashIsaBalance] = useState("10000");
  const [cashIsaMonthlyContrib, setCashIsaMonthlyContrib] = useState("100");
  const [cashIsaGrowthRate, setCashIsaGrowthRate] = useState("3");
  const [ssIsaBalance, setSsIsaBalance] = useState("18000");
  const [ssIsaMonthlyContrib, setSsIsaMonthlyContrib] = useState("200");
  const [ssIsaGrowthRate, setSsIsaGrowthRate] = useState("7");

  const [giaBalance, setGiaBalance] = useState("0");
  const [giaMonthlyContrib, setGiaMonthlyContrib] = useState("0");
  const [giaGrowthRate, setGiaGrowthRate] = useState("5");

  // ─── Mark dirty ───
  const inputsKey = JSON.stringify([
    dob, statePensionAge, retireAge, targetIncome, qualifyingYears, weeklyForecast,
    householdType, planToAge, dcPotValue, annualSalary, dcContribYoursPct,
    dcContribEmployerPct, dcGrowthRate, inflationRate, lumpSumMode,
    cashIsaBalance, cashIsaMonthlyContrib, cashIsaGrowthRate,
    ssIsaBalance, ssIsaMonthlyContrib, ssIsaGrowthRate,
    giaBalance, giaMonthlyContrib, giaGrowthRate,
  ]);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setIsDirty(true);
  }, [inputsKey]);

  const gatherInputs = () => ({
    dob, statePensionAge, retireAge, targetIncome, qualifyingYears, weeklyForecast,
    householdType, planToAge,
    dcPotValue, annualSalary, dcContribYoursPct, dcContribEmployerPct,
    dcGrowthRate, inflationRate, lumpSumMode,
    cashIsaBalance, cashIsaMonthlyContrib, cashIsaGrowthRate,
    ssIsaBalance, ssIsaMonthlyContrib, ssIsaGrowthRate,
    giaBalance, giaMonthlyContrib, giaGrowthRate,
  });

  const applyInputs = (inputs) => {
    if (inputs.dob !== undefined) setDob(inputs.dob);
    if (inputs.statePensionAge !== undefined) setStatePensionAge(inputs.statePensionAge);
    if (inputs.retireAge !== undefined) setRetireAge(inputs.retireAge);
    if (inputs.targetIncome !== undefined) setTargetIncome(String(inputs.targetIncome));
    if (inputs.qualifyingYears !== undefined) setQualifyingYears(inputs.qualifyingYears);
    if (inputs.weeklyForecast !== undefined) setWeeklyForecast(String(inputs.weeklyForecast));
    if (inputs.householdType !== undefined) setHouseholdType(inputs.householdType);
    if (inputs.planToAge !== undefined) setPlanToAge(String(inputs.planToAge));
    if (inputs.dcPotValue !== undefined) setDcPotValue(String(inputs.dcPotValue));
    if (inputs.annualSalary !== undefined) setAnnualSalary(String(inputs.annualSalary));
    if (inputs.dcContribYoursPct !== undefined) setDcContribYoursPct(String(inputs.dcContribYoursPct));
    if (inputs.dcContribEmployerPct !== undefined) setDcContribEmployerPct(String(inputs.dcContribEmployerPct));
    if (inputs.dcGrowthRate !== undefined) setDcGrowthRate(String(inputs.dcGrowthRate));
    if (inputs.inflationRate !== undefined) setInflationRate(String(inputs.inflationRate));
    if (inputs.lumpSumMode !== undefined) setLumpSumMode(inputs.lumpSumMode);
    if (inputs.cashIsaBalance !== undefined) setCashIsaBalance(String(inputs.cashIsaBalance));
    if (inputs.cashIsaMonthlyContrib !== undefined) setCashIsaMonthlyContrib(String(inputs.cashIsaMonthlyContrib));
    if (inputs.cashIsaGrowthRate !== undefined) setCashIsaGrowthRate(String(inputs.cashIsaGrowthRate));
    if (inputs.ssIsaBalance !== undefined) setSsIsaBalance(String(inputs.ssIsaBalance));
    if (inputs.ssIsaMonthlyContrib !== undefined) setSsIsaMonthlyContrib(String(inputs.ssIsaMonthlyContrib));
    if (inputs.ssIsaGrowthRate !== undefined) setSsIsaGrowthRate(String(inputs.ssIsaGrowthRate));
    if (inputs.giaBalance !== undefined) setGiaBalance(String(inputs.giaBalance));
    if (inputs.giaMonthlyContrib !== undefined) setGiaMonthlyContrib(String(inputs.giaMonthlyContrib));
    if (inputs.giaGrowthRate !== undefined) setGiaGrowthRate(String(inputs.giaGrowthRate));
  };

  // ─── Save handler ───
  const handleSave = () => {
    const saveData = createSaveData(gatherInputs(), taxConfig);
    const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `retireclear-${taxConfig.year.replace("/", "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setLastSavedAt(new Date().toISOString());
    setIsDirty(false);
    setLoadMessage({ type: "success", text: "Scenario saved" });
    setTimeout(() => setLoadMessage(null), 3000);
  };

  // ─── Load handler ───
  const handleLoad = () => { fileInputRef.current?.click(); };
  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const raw = JSON.parse(evt.target.result);
        const { valid, error, data } = validateSaveData(raw);
        if (!valid) {
          setLoadMessage({ type: "error", text: error });
          setTimeout(() => setLoadMessage(null), 5000);
          return;
        }

        const currentYear = DEFAULT_TAX_CONFIG.year;
        const savedYear = data.taxConfig?.year || currentYear;
        const isAnnualReview = savedYear !== currentYear;

        if (isAnnualReview) {
          const prev = data.inputs;
          setReviewData({
            previousInputs: { ...prev },
            previousTaxYear: savedYear,
            currentTaxYear: currentYear,
            savedAtReadable: data.savedAtReadable || "previously",
            prevDcPot: prev.dcPotValue || "0",
            prevCashIsaBalance: prev.cashIsaBalance || "0",
            prevSsIsaBalance: prev.ssIsaBalance || "0",
            prevGiaBalance: prev.giaBalance || "0",
            prevSalary: prev.annualSalary || "0",
            prevTargetIncome: prev.targetIncome || "25000",
            prevRetireAge: prev.retireAge || 60,
            prevDcContribYoursPct: prev.dcContribYoursPct || "0",
            prevDcContribEmployerPct: prev.dcContribEmployerPct || "0",
            prevQualifyingYears: prev.qualifyingYears || 0,
          });
        } else {
          setReviewData(null);
        }

        applyInputs(data.inputs);
        if (isAnnualReview && data.inputs.qualifyingYears !== undefined) {
          setQualifyingYears(data.inputs.qualifyingYears + 1);
        }
        if (data.taxConfig) {
          setTaxConfig(data.taxConfig);
          TAX_CONFIG = data.taxConfig;
        }
        setLastSavedAt(data.savedAt);
        setIsDirty(isAnnualReview);
        setActiveTab("plan");

        if (isAnnualReview) {
          setLoadMessage({
            type: "info",
            text: `Annual review: loaded your ${savedYear} scenario. Qualifying years auto-incremented to ${data.inputs.qualifyingYears + 1} — check this is correct, then update your other figures and save your new ${currentYear} plan.`,
          });
        } else {
          setLoadMessage({
            type: "success",
            text: `Scenario loaded (saved ${data.savedAtReadable || "previously"})`,
          });
          setTimeout(() => setLoadMessage(null), 4000);
        }
      } catch (err) {
        setLoadMessage({ type: "error", text: "Could not read file — is it a valid JSON file?" });
        setTimeout(() => setLoadMessage(null), 5000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleResetTaxConfig = () => {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_TAX_CONFIG));
    setTaxConfig(fresh);
    TAX_CONFIG = fresh;
    setIsDirty(true);
  };

  // Derived values
  const monthlySalary = (parseFloat(annualSalary) || 0) / 12;
  const dcContribYoursMonthly = monthlySalary * ((parseFloat(dcContribYoursPct) || 0) / 100);
  const dcContribEmployerMonthly = monthlySalary * ((parseFloat(dcContribEmployerPct) || 0) / 100);

  const calculateFutureYears = useCallback(() => {
    if (!dob) return 0;
    const birth = new Date(dob);
    const now = new Date();
    const currentAge = (now - birth) / (365.25 * 24 * 60 * 60 * 1000);
    const yearsUntilSPA = statePensionAge - currentAge;
    return Math.max(0, Math.round(yearsUntilSPA));
  }, [dob, statePensionAge]);

  const spResult = calculateStatePension({
    qualifyingYearsCurrent: qualifyingYears,
    qualifyingYearsFuture: calculateFutureYears(),
    weeklyForecast: parseFloat(weeklyForecast) || 0,
    statePensionAge,
    dateOfBirth: dob,
  });

  const currentAge = (() => {
    if (!dob) return 30;
    const birth = new Date(dob);
    const now = new Date();
    return (now - birth) / (365.25 * 24 * 60 * 60 * 1000);
  })();

  const dcResult = calculateDCPension({
    currentPotValue: parseFloat(dcPotValue) || 0,
    monthlyContributionYours: dcContribYoursMonthly,
    monthlyContributionEmployer: dcContribEmployerMonthly,
    annualGrowthRate: parseFloat(dcGrowthRate) || 5,
    inflationRate: parseFloat(inflationRate) || 2,
    retireAge,
    currentAge,
    lumpSumMode,
    planToAge: parseInt(planToAge) || 90,
    statePensionAge,
    statePensionAnnual: spResult.annualAmount,
  });

  const taxFreePerWithdrawal = lumpSumMode === "phased" ? 0.25 : 0;
  const dcAnnualDrawdown = dcResult.annualDrawdown;

  const dcTaxablePreSP = dcAnnualDrawdown * (1 - taxFreePerWithdrawal);
  const taxResultPreSP = calculateIncomeTax(dcTaxablePreSP);
  const dcNetPreSP = dcAnnualDrawdown - taxResultPreSP.totalTax;

  const dcTaxablePostSP = dcAnnualDrawdown * (1 - taxFreePerWithdrawal) + spResult.annualAmount;
  const taxResultPostSP = calculateIncomeTax(dcTaxablePostSP);
  const dcNetPostSP = dcAnnualDrawdown + spResult.annualAmount - taxResultPostSP.totalTax;

  // ISA calculations
  const cashIsaRealGrowth = ((1 + (parseFloat(cashIsaGrowthRate) || 3) / 100) / (1 + (parseFloat(inflationRate) || 2) / 100)) - 1;
  const cashIsaMonthlyGrowth = Math.pow(1 + cashIsaRealGrowth, 1 / 12) - 1;
  const yearsToRetirement = Math.max(0, retireAge - currentAge);
  const monthsToRetirement = Math.round(yearsToRetirement * 12);
  let cashIsaAtRetirement = parseFloat(cashIsaBalance) || 0;
  for (let m = 0; m < monthsToRetirement; m++) {
    cashIsaAtRetirement = cashIsaAtRetirement * (1 + cashIsaMonthlyGrowth) + (parseFloat(cashIsaMonthlyContrib) || 0);
  }

  const ssIsaRealGrowth = ((1 + (parseFloat(ssIsaGrowthRate) || 7) / 100) / (1 + (parseFloat(inflationRate) || 2) / 100)) - 1;
  const ssIsaMonthlyGrowth = Math.pow(1 + ssIsaRealGrowth, 1 / 12) - 1;
  let ssIsaAtRetirement = parseFloat(ssIsaBalance) || 0;
  for (let m = 0; m < monthsToRetirement; m++) {
    ssIsaAtRetirement = ssIsaAtRetirement * (1 + ssIsaMonthlyGrowth) + (parseFloat(ssIsaMonthlyContrib) || 0);
  }

  const totalIsaBalance = (parseFloat(cashIsaBalance) || 0) + (parseFloat(ssIsaBalance) || 0);
  const totalIsaMonthlyContrib = (parseFloat(cashIsaMonthlyContrib) || 0) + (parseFloat(ssIsaMonthlyContrib) || 0);
  const combinedIsaAtRetirement = cashIsaAtRetirement + ssIsaAtRetirement;
  const blendedIsaGrowthRate = combinedIsaAtRetirement > 0
    ? ((cashIsaAtRetirement * (parseFloat(cashIsaGrowthRate) || 3)) + (ssIsaAtRetirement * (parseFloat(ssIsaGrowthRate) || 7))) / combinedIsaAtRetirement
    : (parseFloat(ssIsaGrowthRate) || 7);

  const isaResult = calculateISA({
    currentBalance: totalIsaBalance,
    monthlyContribution: totalIsaMonthlyContrib,
    annualGrowthRate: blendedIsaGrowthRate,
    inflationRate: parseFloat(inflationRate) || 2,
    retireAge,
    currentAge,
    planToAge: parseInt(planToAge) || 90,
    statePensionAge,
    statePensionAnnual: spResult.annualAmount,
  });

  const giaResult = calculateGIA({
    currentBalance: parseFloat(giaBalance) || 0,
    monthlyContribution: parseFloat(giaMonthlyContrib) || 0,
    annualGrowthRate: parseFloat(giaGrowthRate) || 5,
    inflationRate: parseFloat(inflationRate) || 2,
    retireAge,
    currentAge,
    planToAge: parseInt(planToAge) || 90,
    statePensionAge,
    statePensionAnnual: spResult.annualAmount,
  });

  // ─── Unified Timeline ───
  const pToAge = parseInt(planToAge) || 90;
  const unifiedTimeline = [];
  for (let age = retireAge; age <= pToAge; age++) {
    const spGross = age >= statePensionAge ? spResult.annualAmount : 0;
    const dcYear = dcResult.drawdownTimeline.find(y => y.age === age);
    const dcGross = dcYear ? dcYear.withdrawal : 0;
    const dcTaxFree = dcGross * taxFreePerWithdrawal;
    const dcTaxable = dcGross - dcTaxFree;
    const isaYear = isaResult.drawdownTimeline.find(y => y.age === age);
    const isaGross = isaYear ? isaYear.withdrawal : 0;
    const giaYear = giaResult.drawdownTimeline.find(y => y.age === age);
    const giaGross = giaYear ? giaYear.withdrawal : 0;
    const giaGain = giaYear ? giaYear.taxableGain : 0;

    const totalGross = spGross + dcGross + isaGross + giaGross;
    const totalTaxableIncome = spGross + dcTaxable;
    const yearTax = calculateIncomeTax(totalTaxableIncome);
    const yearCGT = calculateCGT(giaGain, totalTaxableIncome);
    const totalTax = yearTax.totalTax + yearCGT.tax;
    const totalNet = totalGross - totalTax;

    unifiedTimeline.push({
      age,
      spGross, dcGross, dcTaxFree, dcTaxable, isaGross, giaGross, giaGain,
      totalGross, totalTaxableIncome,
      incomeTax: yearTax.totalTax, cgt: yearCGT.tax, tax: totalTax,
      effectiveRate: totalGross > 0 ? totalTax / totalGross : 0,
      marginalRate: yearTax.marginalRate,
      isPATapered: yearTax.isPATapered,
      personalAllowance: yearTax.personalAllowance,
      bands: yearTax.bands,
      totalNet,
      spNet: spGross > 0 && totalTaxableIncome > 0
        ? spGross - yearTax.totalTax * (spGross / totalTaxableIncome) : spGross,
      dcNet: dcGross > 0 && totalTaxableIncome > 0
        ? dcGross - yearTax.totalTax * (dcTaxable / totalTaxableIncome) : dcGross,
      isaNet: isaGross,
      giaNet: giaGross - yearCGT.tax,
    });
  }

  const hasBridgeYears = retireAge < statePensionAge;
  const preSPYear = hasBridgeYears ? unifiedTimeline.find(y => y.age === retireAge) : null;
  const postSPYear = hasBridgeYears
    ? unifiedTimeline.find(y => y.age === statePensionAge)
    : unifiedTimeline.find(y => y.age === retireAge);

  const preSPTaxResult = preSPYear ? calculateIncomeTax(preSPYear.totalTaxableIncome) : calculateIncomeTax(0);
  const postSPTaxResult = postSPYear ? calculateIncomeTax(postSPYear.totalTaxableIncome) : calculateIncomeTax(0);
  const preSPNetFromDC = preSPYear ? preSPYear.dcNet : 0;
  const preSPTotalNet = preSPYear ? preSPYear.totalNet : 0;
  const postSPNetTotal = postSPYear ? postSPYear.totalNet : 0;

  const spPAUsage = Math.min(spResult.annualAmount, TAX_CONFIG.incomeTax.personalAllowance);
  const paRemainingAfterSP = Math.max(0, TAX_CONFIG.incomeTax.personalAllowance - spResult.annualAmount);

  const actionPlan = calculateActionPlan({
    annualSalary: parseFloat(annualSalary) || 0,
    dcContribYoursPct: parseFloat(dcContribYoursPct) || 0,
    dcContribEmployerPct: parseFloat(dcContribEmployerPct) || 0,
    dcPotValue, dcGrowthRate, inflationRate,
    cashIsaBalance, cashIsaMonthlyContrib, ssIsaBalance, ssIsaMonthlyContrib,
    cashIsaGrowthRate, ssIsaGrowthRate, lumpSumMode,
    targetIncome: parseFloat(targetIncome) || 25000,
    retireAge, planToAge, statePensionAge,
    statePensionAnnual: spResult.annualAmount,
    currentProjectedNet: postSPNetTotal,
    currentBridgeNet: preSPTotalNet,
    currentAge,
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setChartTooltip(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handler = () => { setScrollY(window.scrollY); setChartTooltip(null); };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div style={{
      background: C.bg, minHeight: "100vh", color: C.text,
      fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, sans-serif",
      position: "relative",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <Background />

      {/* ─── Chart bar tooltip ─── */}
      {chartTooltip && (
        <div style={{
          position: "fixed",
          left: chartTooltip.x,
          top: chartTooltip.y,
          transform: "translate(-50%, -100%)",
          zIndex: 200,
          pointerEvents: "none",
          animation: "fadeIn 0.15s ease",
        }}>
          <div style={{
            background: C.card,
            border: `1px solid ${chartTooltip.color}40`,
            borderRadius: 10,
            padding: "8px 12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
            whiteSpace: "nowrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: chartTooltip.color }} />
              <span style={{ fontSize: 11, color: C.textSoft }}>
                {chartTooltip.label} · age {chartTooltip.age}
              </span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: chartTooltip.color }}>
              {formatCurrency(Math.round(chartTooltip.value))}<span style={{ fontSize: 11, fontWeight: 400, color: C.textDim }}>/yr</span>
            </div>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
              of {formatCurrency(Math.round(chartTooltip.total))} total
            </div>
          </div>
          <div style={{
            width: 0, height: 0, margin: "0 auto",
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: `5px solid ${C.card}`,
          }} />
        </div>
      )}

      {/* Hidden file input for Load */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />

      {/* ─── Load/Save message toast ─── */}
      {loadMessage && (
        <div style={{
          position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
          zIndex: 100, padding: "10px 20px", borderRadius: 12,
          background: loadMessage.type === "error" ? C.redLight : loadMessage.type === "info" ? C.blueLight : C.greenLight,
          border: `1px solid ${loadMessage.type === "error" ? C.red : loadMessage.type === "info" ? C.blue : C.green}25`,
          color: loadMessage.type === "error" ? C.red : loadMessage.type === "info" ? C.blue : C.green,
          fontSize: 13, fontWeight: 500,
          maxWidth: 480, textAlign: "center",
          animation: "fadeIn 0.3s ease",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        }}>
          {loadMessage.text}
          {loadMessage.type === "info" && (
            <button
              onClick={() => setLoadMessage(null)}
              style={{
                marginLeft: 12, background: "transparent", border: `1px solid ${C.blue}40`,
                borderRadius: 6, padding: "4px 10px", color: C.blue,
                cursor: "pointer", fontSize: 12,
              }}
            >Got it</button>
          )}
        </div>
      )}

      {/* ─── Settings Modal ─── */}
      {showSettings && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)",
        }} onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div style={{
            background: C.card, borderRadius: 20, padding: "32px 28px",
            width: "90%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Tax Year Settings</div>
                <div style={{ fontSize: 13, color: C.textDim, marginTop: 4 }}>
                  Adjust rates for different tax years. Current: {taxConfig.year}
                </div>
              </div>
              <button onClick={() => setShowSettings(false)} style={{
                background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: C.textDim,
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              }}>✕</button>
            </div>

            {/* Income Tax section */}
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>Income Tax</div>
            {[
              { label: "Personal Allowance", path: ["incomeTax", "personalAllowance"], prefix: "£" },
              { label: "Basic Rate", path: ["incomeTax", "basicRate"], suffix: "%", isRate: true },
              { label: "Basic Rate Limit", path: ["incomeTax", "basicRateLimit"], prefix: "£" },
              { label: "Higher Rate", path: ["incomeTax", "higherRate"], suffix: "%", isRate: true },
              { label: "Additional Rate", path: ["incomeTax", "additionalRate"], suffix: "%", isRate: true },
            ].map(({ label, path, prefix, suffix, isRate }) => {
              const val = taxConfig[path[0]][path[1]];
              return (
                <div key={path.join(".")} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <label style={{ flex: 1, fontSize: 12, color: C.textSoft }}>{label}</label>
                  <div style={{ position: "relative", width: 140 }}>
                    {prefix && <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textDim, fontSize: 13, pointerEvents: "none" }}>{prefix}</span>}
                    <input
                      type="text"
                      value={isRate ? (val * 100).toString() : val.toString()}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9.]/g, "");
                        const num = parseFloat(raw);
                        if (!isNaN(num)) {
                          setTaxConfig(c => {
                            const next = JSON.parse(JSON.stringify(c));
                            next[path[0]][path[1]] = isRate ? num / 100 : num;
                            if (path[1] === "personalAllowance" || path[1] === "basicRateLimit") {
                              next.incomeTax.basicRateThreshold = next.incomeTax.personalAllowance + next.incomeTax.basicRateLimit;
                              next.incomeTax.personalAllowanceTaperEnd = 100000 + (next.incomeTax.personalAllowance * 2);
                            }
                            return next;
                          });
                          setIsDirty(true);
                        }
                      }}
                      style={{
                        width: "100%", padding: "8px 12px", background: C.bg, border: `1.5px solid ${C.border}`,
                        borderRadius: 8, color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box",
                        textAlign: "right",
                        paddingLeft: prefix ? 24 : 12, paddingRight: suffix ? 28 : 12,
                      }}
                    />
                    {suffix && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: C.textDim, fontSize: 13, pointerEvents: "none" }}>{suffix}</span>}
                  </div>
                </div>
              );
            })}

            {/* State Pension section */}
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12, marginTop: 24 }}>State Pension</div>
            {[
              { label: "Full Weekly Rate", path: ["statePension", "fullWeeklyRate"], prefix: "£" },
            ].map(({ label, path, prefix }) => {
              const val = taxConfig[path[0]][path[1]];
              return (
                <div key={path.join(".")} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <label style={{ flex: 1, fontSize: 12, color: C.textSoft }}>{label}</label>
                  <div style={{ position: "relative", width: 140 }}>
                    {prefix && <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textDim, fontSize: 13, pointerEvents: "none" }}>{prefix}</span>}
                    <input
                      type="text" value={val.toString()}
                      onChange={e => {
                        const num = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
                        if (!isNaN(num)) {
                          setTaxConfig(c => {
                            const next = JSON.parse(JSON.stringify(c));
                            next.statePension.fullWeeklyRate = num;
                            next.statePension.fullAnnualRate = Math.round(num * 52);
                            return next;
                          });
                          setIsDirty(true);
                        }
                      }}
                      style={{
                        width: "100%", padding: "8px 12px", background: C.bg, border: `1.5px solid ${C.border}`,
                        borderRadius: 8, color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box",
                        textAlign: "right", paddingLeft: 24,
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Allowances section */}
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12, marginTop: 24 }}>Allowances</div>
            {[
              { label: "Pension Annual Allowance", path: ["pensionAllowance", "annualAllowance"], prefix: "£" },
              { label: "ISA Annual Allowance", path: ["isaAllowance", "annualAllowance"], prefix: "£" },
            ].map(({ label, path, prefix }) => {
              const val = taxConfig[path[0]][path[1]];
              return (
                <div key={path.join(".")} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <label style={{ flex: 1, fontSize: 12, color: C.textSoft }}>{label}</label>
                  <div style={{ position: "relative", width: 140 }}>
                    {prefix && <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textDim, fontSize: 13, pointerEvents: "none" }}>{prefix}</span>}
                    <input
                      type="text" value={val.toString()}
                      onChange={e => {
                        const num = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
                        if (!isNaN(num)) {
                          setTaxConfig(c => { const next = JSON.parse(JSON.stringify(c)); next[path[0]][path[1]] = num; return next; });
                          setIsDirty(true);
                        }
                      }}
                      style={{
                        width: "100%", padding: "8px 12px", background: C.bg, border: `1.5px solid ${C.border}`,
                        borderRadius: 8, color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box",
                        textAlign: "right", paddingLeft: 24,
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Reset + close buttons */}
            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button
                onClick={handleResetTaxConfig}
                style={{
                  flex: 1, padding: "10px 16px", borderRadius: 10, cursor: "pointer",
                  background: "transparent", border: `1px solid ${C.border}`,
                  color: C.textSoft, fontSize: 13, fontFamily: "inherit",
                }}
              >Reset to {DEFAULT_TAX_CONFIG.year} Defaults</button>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  flex: 1, padding: "10px 16px", borderRadius: 10, cursor: "pointer",
                  background: C.pink, border: "none",
                  color: "#ffffff", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                }}
              >Done</button>
            </div>

            <div style={{ marginTop: 16, fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
              Changes take effect immediately in all calculations. Save your scenario to keep the updated rates. Source for current rates: GOV.UK.
            </div>
          </div>
        </div>
      )}

      {/* ─── Octopus Money Banner + RetireClear Nav ─── */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
        {/* Top: Octopus Money dark navy banner */}
        <div style={{
          background: C.text,
          padding: "10px 24px",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ maxWidth: 780, width: "100%", display: "flex", alignItems: "center" }}>
            <span style={{
              fontSize: 22, fontWeight: 400, color: "#ffffff", letterSpacing: "-0.02em",
            }}>
              <span style={{ fontWeight: 900 }}>octopus</span>money
            </span>
          </div>
        </div>

        {/* Bottom: RetireClear nav bar */}
        <div style={{
          padding: "10px 24px",
          background: scrollY > 50 ? `${C.bg}f0` : C.bg,
          backdropFilter: scrollY > 50 ? "blur(16px)" : "none",
          borderBottom: `1px solid ${C.border}`,
          transition: "all 0.4s ease",
        }}>
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: C.pink,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 14, color: "#ffffff",
                }}>R</div>
                <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em", color: C.text }}>
                  Retire<span style={{ color: C.pink }}>Clear</span>
                </span>
                <span style={{ fontSize: 11, color: C.textDim, fontWeight: 500, marginLeft: 4 }}>
                  by Octopus Money
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {isDirty && (
                  <span style={{
                    fontSize: 11, color: C.amber, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 5, marginRight: 4,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.amber }} />
                    unsaved
                  </span>
                )}
                <button
                  onClick={() => setShowSettings(true)}
                  style={{
                    background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: "6px 8px", color: C.textDim, cursor: "pointer", fontSize: 13,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "color 0.2s, border-color 0.2s",
                  }}
                  title="Tax year settings"
                  onMouseEnter={e => { e.currentTarget.style.color = C.textSoft; e.currentTarget.style.borderColor = C.textDim; }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.textDim; e.currentTarget.style.borderColor = C.border; }}
                >⚙</button>
                <button
                  onClick={handleLoad}
                  style={{
                    background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: "6px 14px", color: C.textSoft, cursor: "pointer", fontSize: 12,
                    fontFamily: "inherit", fontWeight: 500,
                  }}
                >Load</button>
                <button
                  onClick={handleSave}
                  style={{
                    background: isDirty ? C.pink : `${C.pink}18`,
                    border: isDirty ? "none" : `1px solid ${C.pink}30`, borderRadius: 10,
                    padding: "6px 14px", color: isDirty ? "#ffffff" : C.pink, cursor: "pointer", fontSize: 12,
                    fontWeight: 600, fontFamily: "inherit",
                    transition: "all 0.3s ease",
                  }}
                >Save</button>
              </div>
            </div>
            <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px", position: "relative", zIndex: 1 }}>

        {/* ═══════ HERO ═══════ */}
        <div style={{ paddingTop: 175, paddingBottom: 24, position: "relative" }}>
          {/* Paper circle — peeking from top right behind hero */}
          <Reveal direction="left">
            <SectionLabel text="UK Retirement Planner" />
          </Reveal>
          <Reveal delay={0.1} direction="left" blur>
            <h1 style={{
              fontSize: 42, fontWeight: 900, margin: "12px 0 0", letterSpacing: "-0.03em",
              lineHeight: 1.15, maxWidth: 600, color: C.text,
            }}>
              See your retirement<br />
              <span style={{ color: C.pink }}>with clarity</span>
            </h1>
          </Reveal>
          <Reveal delay={0.25} direction="left">
            <p style={{ fontSize: 16, color: C.textSoft, lineHeight: 1.7, maxWidth: 520, marginTop: 14 }}>
              Set your retirement goals, enter your details, and see exactly where you stand — with a clear plan to get there.
            </p>
          </Reveal>
        </div>
        {activeTab === "plan" && (<>

        {/* ═══════ ANNUAL REVIEW COMPARISON PANEL ═══════ */}
        {reviewData && (
          <Reveal scale blur>
            <div style={{
              marginTop: 8, padding: "28px 28px", borderRadius: 16, position: "relative", overflow: "hidden",
              background: C.blueLight,
              border: `1px solid ${C.blue}30`,
            }}>
              
              

              <div style={{ position: "relative", zIndex: 1 }}>
                {/* Header with dismiss */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <div style={{
                      fontSize: 11, color: C.blue, textTransform: "uppercase",
                      letterSpacing: "0.12em", fontFamily: "inherit", marginBottom: 8,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.blue }} />
                      Annual Review
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                      Year-on-Year Comparison
                    </div>
                    <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.5 }}>
                      Your {reviewData.previousTaxYear} scenario vs your updated figures.
                      Saved {reviewData.savedAtReadable}. Update your pot values, salary, and contributions below.
                    </div>
                  </div>
                  <button
                    onClick={() => setReviewData(null)}
                    style={{
                      background: "transparent", border: `1px solid ${C.border}`,
                      borderRadius: 8, padding: "6px 14px", color: C.textDim, cursor: "pointer",
                      fontSize: 12, fontFamily: "'Nunito', sans-serif", flexShrink: 0,
                    }}
                  >Dismiss</button>
                </div>

                {/* Comparison grid */}
                {(() => {
                  const prev = reviewData;
                  const prevDcPot = parseFloat(prev.prevDcPot) || 0;
                  const currDcPot = parseFloat(dcPotValue) || 0;
                  const prevIsaTotal = (parseFloat(prev.prevCashIsaBalance) || 0) + (parseFloat(prev.prevSsIsaBalance) || 0);
                  const currIsaTotal = (parseFloat(cashIsaBalance) || 0) + (parseFloat(ssIsaBalance) || 0);
                  const prevGia = parseFloat(prev.prevGiaBalance) || 0;
                  const currGia = parseFloat(giaBalance) || 0;
                  const prevSalary = parseFloat(prev.prevSalary) || 0;
                  const currSalary = parseFloat(annualSalary) || 0;
                  const prevQY = prev.prevQualifyingYears || 0;
                  const currQY = qualifyingYears;

                  const DeltaCell = ({ label, prevVal, currVal, format = "currency" }) => {
                    const delta = currVal - prevVal;
                    const improved = delta > 0;
                    const changed = Math.abs(delta) > 0.5;
                    const fmtVal = (v) => format === "currency" ? formatCurrency(Math.round(v)) : v;
                    return (
                      <div style={{
                        flex: "1 1 160px", padding: "14px 16px",
                        background: changed ? `${improved ? C.green : C.red}06` : C.bgAlt,
                        border: `1px solid ${changed ? (improved ? C.green : C.red) + "20" : C.border}`,
                        borderRadius: 12,
                      }}>
                        <div style={{ fontSize: 10, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                          {label}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "inherit", color: C.text, marginBottom: 4 }}>
                          {fmtVal(currVal)}
                        </div>
                        <div style={{ fontSize: 12, color: C.textDim }}>
                          was {fmtVal(prevVal)}
                          {changed && (
                            <span style={{ color: improved ? C.green : C.red, fontWeight: 600, marginLeft: 6 }}>
                              {improved ? "+" : ""}{fmtVal(delta)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                      <DeltaCell label="DC Pension Pot" prevVal={prevDcPot} currVal={currDcPot} />
                      <DeltaCell label="ISA Balance" prevVal={prevIsaTotal} currVal={currIsaTotal} />
                      {(prevGia > 0 || currGia > 0) && (
                        <DeltaCell label="GIA Balance" prevVal={prevGia} currVal={currGia} />
                      )}
                      <DeltaCell label="Salary" prevVal={prevSalary} currVal={currSalary} />
                      <DeltaCell label="NI Qualifying Years" prevVal={prevQY} currVal={currQY} format="number" />
                    </div>
                  );
                })()}

                {/* Projected income comparison — uses current calculated values */}
                <div style={{
                  marginTop: 16, padding: "14px 18px",
                  background: `${C.cyan}06`, border: `1px solid ${C.cyan}15`,
                  borderRadius: 12, fontSize: 13, color: C.textSoft, lineHeight: 1.65,
                }}>
                  <strong style={{ color: C.cyan }}>Projected net income (at State Pension age):</strong>{" "}
                  {formatCurrency(Math.round(postSPNetTotal))}/year.
                  {actionPlan.hasGap ? (
                    <span> That's {formatCurrency(actionPlan.gap)}/year below your target of {formatCurrency(actionPlan.targetIncome)}. Check the Action Plan tab for updated recommendations.</span>
                  ) : (
                    <span> You're on track — {formatCurrency(Math.abs(actionPlan.gap))}/year above your target of {formatCurrency(actionPlan.targetIncome)}.</span>
                  )}
                  {actionPlan.achievableAge && (
                    <span> Earliest viable retirement age: <strong style={{ color: C.text }}>{actionPlan.achievableAge}</strong>.</span>
                  )}
                </div>

                {/* Tax year update prompt */}
                {reviewData.previousTaxYear !== DEFAULT_TAX_CONFIG.year && taxConfig.year !== DEFAULT_TAX_CONFIG.year && (
                  <div style={{
                    marginTop: 10, padding: "10px 14px",
                    background: C.amberLight, border: `1px solid #f59e0b20`,
                    borderRadius: 8, fontSize: 12, color: C.textDim, lineHeight: 1.6,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}>
                    <span>Tax rates are still set to {taxConfig.year}. Update to {DEFAULT_TAX_CONFIG.year} rates?</span>
                    <button
                      onClick={() => {
                        const fresh = JSON.parse(JSON.stringify(DEFAULT_TAX_CONFIG));
                        setTaxConfig(fresh);
                        TAX_CONFIG = fresh;
                        setIsDirty(true);
                      }}
                      style={{
                        background: `linear-gradient(135deg, ${C.pink}20, ${C.blue}20)`,
                        border: `1px solid ${C.pink}30`, borderRadius: 6,
                        padding: "6px 14px", color: C.pink, cursor: "pointer",
                        fontSize: 12, fontWeight: 500, fontFamily: "'Nunito', sans-serif",
                        flexShrink: 0, whiteSpace: "nowrap",
                      }}
                    >Update Rates</button>
                  </div>
                )}

                <div style={{ marginTop: 12, fontSize: 12, color: C.textDim }}>
                  Update your current pot values, salary, and contributions in the sections below. Your NI qualifying years have been automatically incremented by 1. When you're done, save to create your new {DEFAULT_TAX_CONFIG.year} scenario.
                </div>
              </div>
            </div>
          </Reveal>
        )}

        {/* ═══════ SECTION 0: MY GOAL ═══════ */}
        <Divider  />
          <Reveal>
          <SectionLabel text="Your Goal" />
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: "12px 0 8px", letterSpacing: "-0.02em" }}>
            What retirement do you want?
          </h2>
          <p style={{ color: C.textSoft, fontSize: 15, lineHeight: 1.6, marginBottom: 32, marginTop: 0 }}>
            Start with the big questions — when and how much. We'll work backwards from here.
          </p>
        </Reveal>

        <Reveal delay={0.08} direction="right">
          <Field
            label="Target Retirement Age"
            tip="When do you want to stop working? This doesn't have to match your State Pension age — many people retire earlier and bridge the gap with private savings."
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <input
                type="range" min="55" max="75" value={retireAge}
                onChange={e => setRetireAge(parseInt(e.target.value) || 60)}
                style={{ flex: 1, accentColor: C.text }}
              />
              <div style={{
                minWidth: 56, textAlign: "center", padding: "8px 12px",
                background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                fontFamily: "inherit", fontSize: 20, fontWeight: 700, color: C.text,
              }}>{retireAge}</div>
            </div>
            {retireAge < statePensionAge && retireAge > Math.floor(currentAge) && (
              <div style={{
                marginTop: 8, fontSize: 12, color: C.violet,
                fontFamily: "inherit",
              }}>
                {statePensionAge - retireAge} bridge years before State Pension at {statePensionAge}
              </div>
            )}
            {retireAge <= Math.floor(currentAge) && (
              <div style={{
                marginTop: 8, fontSize: 12, color: C.amber,
                fontFamily: "inherit",
              }}>
                ⚠ This is at or before your current age ({Math.floor(currentAge)}). The projection shows what retiring now would look like.
              </div>
            )}
            {retireAge >= statePensionAge && (
              <div style={{
                marginTop: 8, fontSize: 12, color: C.green,
                fontFamily: "inherit",
              }}>
                No bridge years — State Pension is available from day one of retirement
              </div>
            )}
          </Field>
        </Reveal>

        <Reveal delay={0.16} direction="right">
          <Field
            label="Target Annual Net Income"
            tip="How much after-tax income do you want each year in retirement? The PLSA benchmarks below give you a sense of what different lifestyles cost. These assume you're mortgage/rent-free."
          >
            <CurrencyInput
              value={targetIncome}
              onValueChange={setTargetIncome}
              suffix="/ year (net)"
            />
            {/* PLSA benchmarks */}
            <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(TAX_CONFIG.retirementStandards).map(([key, std]) => {
                const amount = std.one;
                const isSelected = parseInt(targetIncome) === amount;
                return (
                  <button
                    key={key}
                    onClick={() => setTargetIncome(String(amount))}
                    style={{
                      flex: 1, minWidth: 140, padding: "10px 14px", borderRadius: 8,
                      border: `1px solid ${isSelected ? C.pink + "60" : "#c6e4f6"}`,
                      background: isSelected ? C.pinkGlow : "#e4f2fb",
                      cursor: "pointer", transition: "all 0.3s ease",
                      textAlign: "left",
                    }}
                  >
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: isSelected ? C.pink : C.textSoft,
                      fontFamily: "inherit",
                    }}>
                      {std.label}
                    </div>
                    <div style={{
                      fontSize: 16, fontWeight: 700, color: isSelected ? C.pink : C.text,
                      fontFamily: "inherit", margin: "4px 0",
                    }}>
                      £{amount.toLocaleString("en-GB")}
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.4 }}>
                      {std.desc}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
              Source: PLSA Retirement Living Standards 2025 · one-person household · assumes mortgage/rent-free · after tax
            </div>
          </Field>
        </Reveal>

        <Reveal delay={0.24} direction="right">
          <Field
            label="Plan To Age"
            tip="How long should your money last? Life expectancy for a 65-year-old in the UK is around 86 (men) or 88 (women), but many people live longer. Planning to 90+ gives you a safety margin."
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <input
                type="range" min="80" max="100" value={parseInt(planToAge) || 90}
                onChange={e => setPlanToAge(e.target.value)}
                style={{ flex: 1, accentColor: C.text }}
              />
              <div style={{
                minWidth: 56, textAlign: "center", padding: "8px 12px",
                background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                fontFamily: "inherit", fontSize: 20, fontWeight: 700, color: C.text,
              }}>{planToAge}</div>
            </div>
            {(parseInt(planToAge) || 90) <= retireAge && (
              <div style={{
                marginTop: 8, fontSize: 12, color: C.red,
                fontFamily: "inherit",
              }}>
                ⚠ Plan-to age must be later than your retirement age ({retireAge}). Results may not be meaningful.
              </div>
            )}
          </Field>
        </Reveal>

        <Reveal delay={0.3}>
          <LearnMore title="How much do I actually need in retirement?">
            <p style={{ margin: "0 0 12px" }}>
              The PLSA Retirement Living Standards are a useful starting point. They're based on real research with people across the UK about what different lifestyles cost in retirement, covering everything from groceries and transport to holidays and helping family.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>Minimum ({formatCurrency(TAX_CONFIG.retirementStandards.minimum["one"])}/year):</strong> Covers all your basic needs with some left over for fun. Includes a week's holiday in the UK but no car. For most people receiving the full State Pension and sharing a household, the State Pension alone can cover this.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>Moderate ({formatCurrency(TAX_CONFIG.retirementStandards.moderate["one"])}/year):</strong> More financial security and flexibility. Includes running a car, a two-week foreign holiday each year, and eating out regularly. This is what most people on average earnings with a workplace pension can aim for.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>Comfortable ({formatCurrency(TAX_CONFIG.retirementStandards.comfortable["one"])}/year):</strong> More financial freedom and some luxuries — a three-week foreign holiday, regular beauty treatments, a new kitchen and bathroom every 10–15 years.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.text }}>Important caveat:</strong> These figures assume you are mortgage and rent free. If you'll still be paying rent or a mortgage in retirement, you'll need to add that on top. They also don't include social care costs, which can be significant later in retirement.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              Source: PLSA Retirement Living Standards 2025, calculated by Loughborough University
            </p>
          </LearnMore>
        </Reveal>

        {/* ═══════ SECTION 1: ABOUT YOU ═══════ */}
        <Divider  />
        <Reveal>
          <SectionLabel text="Your Details" />
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: "12px 0 8px", letterSpacing: "-0.02em" }}>About You</h2>
          <p style={{ color: C.textSoft, fontSize: 15, lineHeight: 1.6, marginBottom: 32, marginTop: 0 }}>
            The basics we need to build your retirement timeline.
          </p>
        </Reveal>

        <Reveal delay={0.1} direction="right">
          <Field label="Date of Birth">
            <TextInput type="date" value={dob} onChange={e => setDob(e.target.value)} />
          </Field>
        </Reveal>

        <Reveal delay={0.18} direction="right">
          <Field
            label="State Pension Age"
            tip="Set by the government based on your date of birth. Currently 66, rising to 67 between 2026–2028. A further rise to 68 is legislated for 2044–2046, though this is subject to review. Check yours at gov.uk/state-pension-age."
          >
            <TextInput type="number" value={statePensionAge} onChange={e => setStatePensionAge(Math.min(75, Math.max(55, parseInt(e.target.value) || 67)))} min={55} max={75} />
          </Field>
        </Reveal>

        <Reveal delay={0.26} direction="right">
          <Field
            label="Annual Salary"
            tip="Your current gross (before tax) annual salary. Used to calculate pension contributions as a percentage."
          >
            <CurrencyInput
              value={annualSalary}
              onValueChange={setAnnualSalary}
              suffix="/ year"
            />
          </Field>
        </Reveal>

        {/* ═══════ SECTION 2: STATE PENSION ═══════ */}
        <Divider texture="dots" />
        <Reveal>
          <SectionLabel text="State Pension" />
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: "12px 0 8px", letterSpacing: "-0.02em" }}>State Pension</h2>
          <p style={{ color: C.textSoft, fontSize: 15, lineHeight: 1.6, marginBottom: 32, marginTop: 0 }}>
            Your foundation income in retirement. Paid by the government for life once you reach State Pension age.
          </p>
        </Reveal>

        <Reveal delay={0.1} direction="left">
          <Field
            label="NI Qualifying Years (to date)"
            tip="Each tax year where you paid National Insurance contributions (or received NI credits for things like parenting, caring, or unemployment) counts as a qualifying year. You need 35 years for the full State Pension, and at least 10 to get anything at all. Check yours at gov.uk/check-national-insurance-record."
          >
            <TextInput
              type="number"
              value={qualifyingYears}
              onChange={e => setQualifyingYears(parseInt(e.target.value) || 0)}
              min={0} max={50}
            />
          </Field>
        </Reveal>

        <Reveal delay={0.18} direction="left">
          <Field
            label="Weekly State Pension Forecast"
            tip="Your GOV.UK forecast tells you what you'd get per week at today's rates if you continue contributing until State Pension age. Find it at gov.uk/check-state-pension. If you don't have this, leave it blank and we'll estimate based on your qualifying years (less accurate)."
          >
            <TextInput
              value={weeklyForecast}
              onChange={e => setWeeklyForecast(e.target.value)}
              prefix="£"
              suffix="/week"
              placeholder="e.g. 230.25"
            />
          </Field>
        </Reveal>

        {/* State Pension result */}
        <StatePensionResult result={spResult} />

        {/* Educational content */}
        <Reveal delay={0.3}>
          <LearnMore title="How is the State Pension calculated?">
            <p style={{ margin: "0 0 12px" }}>
              The <strong style={{ color: C.cyan }}>New State Pension</strong> (for anyone reaching State Pension age from April 2016 onwards) works on a simple formula: your pension is proportional to your qualifying years of National Insurance contributions.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              With <strong style={{ color: C.text }}>35 qualifying years</strong>, you get the full amount ({formatCurrency(TAX_CONFIG.statePension.fullWeeklyRate, 2)}/week in {TAX_CONFIG.year}). With fewer years, you get a proportional amount — for example, 20 years gives you 20/35ths of the full rate. You need a <strong style={{ color: C.text }}>minimum of 10 qualifying years</strong> to get anything at all.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>Important:</strong> If you have any NI record from before April 2016, the calculation is more complex — the government calculates a "foundation amount" based on both the old and new rules, and you get whichever is higher. This is why the GOV.UK forecast is more accurate than any simplified calculation for most people.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              Source: GOV.UK — The new State Pension
            </p>
          </LearnMore>

          <LearnMore title="What is the Triple Lock?">
            <p style={{ margin: "0 0 12px" }}>
              The <strong style={{ color: C.cyan }}>Triple Lock</strong> is the government's promise to increase the State Pension each April by whichever is highest:
            </p>
            <p style={{ margin: "0 0 4px" }}>
              <span style={{ color: C.cyan }}>1.</span> Average earnings growth
            </p>
            <p style={{ margin: "0 0 4px" }}>
              <span style={{ color: C.cyan }}>2.</span> Consumer Price Index (CPI) inflation
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <span style={{ color: C.cyan }}>3.</span> A minimum of 2.5%
            </p>
            <p style={{ margin: "0 0 12px" }}>
              This means your State Pension should at least keep pace with the cost of living. For example, from April 2026 the full new State Pension rises by 4.8% to £241.30/week — that's the earnings growth figure, which was the highest of the three measures.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: C.textDim }}>
              The figures we show are in <strong style={{ color: C.text }}>today's money</strong> — meaning we've already accounted for inflation. So £{Math.round(spResult.annualAmount).toLocaleString()}/year represents what that buys you in today's terms, not a lower amount that's been eroded by inflation.
            </p>
          </LearnMore>

          <LearnMore title="What's the difference between State Pension age and retirement age?">
            <p style={{ margin: "0 0 12px" }}>
              Your <strong style={{ color: C.cyan }}>State Pension age</strong> is set by the government — it's when you can start claiming your State Pension. Currently 66, rising to 67 between 2026–2028, and to 68 between 2044–2046 (though that's subject to review).
            </p>
            <p style={{ margin: "0 0 12px" }}>
              Your <strong style={{ color: C.cyan }}>retirement age</strong> is your personal choice — when you want to stop working. You can retire before your State Pension age, but you'll need to fund those years from other sources (DC pensions, ISAs, savings).
            </p>
            <p style={{ margin: 0 }}>
              The gap between these two ages is what we call the <strong style={{ color: C.cyan }}>"bridge years"</strong> — and planning for them is one of the most important parts of retirement planning. If you retire at {retireAge} but your State Pension doesn't start until {statePensionAge}, that's <strong style={{ color: C.text }}>{Math.max(0, statePensionAge - retireAge)} years</strong> you need to fund yourself.
            </p>
          </LearnMore>
        </Reveal>

        {/* ═══════ SECTION 3: DC PENSIONS ═══════ */}
        <Divider  />
        <Reveal>
          <SectionLabel text="Workplace & Private Pensions" />
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: "12px 0 8px", letterSpacing: "-0.02em" }}>Workplace & Private Pensions</h2>
          <p style={{ color: C.textSoft, fontSize: 15, lineHeight: 1.6, marginBottom: 32, marginTop: 0 }}>
            Your defined contribution pots — the money you and your employer have been putting aside, invested and growing until you need it.
          </p>
        </Reveal>

        <Reveal delay={0.1} direction="right">
          <Field
            label="Current Pension Pot Value"
            tip="The total value of all your DC pension pots combined — workplace pensions, SIPPs, and any other defined contribution schemes. You can usually find this on your provider's website or app, or on your annual statement."
          >
            <CurrencyInput
              value={dcPotValue}
              onValueChange={setDcPotValue}
            />
          </Field>
        </Reveal>

        <Reveal delay={0.18} direction="right">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Field
                label="Your Contribution"
                tip="The percentage of your salary you contribute to your pension. The legal minimum employee contribution is 5% (including tax relief). Check your payslip or pension provider for your actual rate."
              >
                <TextInput
                  value={dcContribYoursPct}
                  onChange={e => setDcContribYoursPct(e.target.value.replace(/[^0-9.]/g, ""))}
                  suffix="% of salary"
                />
              </Field>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: -16, marginBottom: 24, fontFamily: "inherit" }}>
                = {formatCurrency(Math.round(dcContribYoursMonthly))}/month
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Field
                label="Employer Contribution"
                tip="The percentage your employer contributes. The legal minimum is 3% of qualifying earnings. Many employers offer to 'match' — e.g. if you put in 5%, they'll match it with 5%. Always check if your employer offers matching — it's free money."
              >
                <TextInput
                  value={dcContribEmployerPct}
                  onChange={e => setDcContribEmployerPct(e.target.value.replace(/[^0-9.]/g, ""))}
                  suffix="% of salary"
                />
              </Field>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: -16, marginBottom: 24, fontFamily: "inherit" }}>
                = {formatCurrency(Math.round(dcContribEmployerMonthly))}/month
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.26} direction="right">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Field
                label="Assumed Growth Rate"
                tip="How much you expect your pension investments to grow per year before inflation. 5% is a common assumption for a balanced fund mixing shares and bonds. Lower risk funds might be 3–4%, higher risk 6–7%. Nothing is guaranteed."
              >
                <TextInput
                  value={dcGrowthRate}
                  onChange={e => setDcGrowthRate(e.target.value.replace(/[^0-9.]/g, ""))}
                  suffix="% / year"
                />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Field
                label="Assumed Inflation Rate"
                tip="The rate at which prices rise each year. The Bank of England targets 2% inflation. We use this to show all figures in today's money — so the numbers you see represent real purchasing power, not inflated future amounts."
              >
                <TextInput
                  value={inflationRate}
                  onChange={e => setInflationRate(e.target.value.replace(/[^0-9.]/g, ""))}
                  suffix="% / year"
                />
              </Field>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.34} direction="right">
          <Field label="Tax-Free Cash Strategy" tip="You can take up to 25% of your pension tax-free. 'Phased' means 25% of each withdrawal is tax-free — this is generally more tax-efficient and is how most advisers recommend structuring drawdown. 'Upfront' takes the full 25% as a lump sum on day one. 'None' keeps the full pot invested for income.">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { id: "phased", label: "Phased — 25% of each withdrawal tax-free", desc: "Recommended · most tax-efficient" },
                    { id: "upfront", label: "Upfront — take full 25% at retirement", desc: "Lump sum on day one" },
                    { id: "none", label: "None — keep full pot invested", desc: "Maximise drawdown income" },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setLumpSumMode(opt.id)}
                      style={{
                        width: "100%", padding: "12px 14px", background: C.bg,
                        border: `1px solid ${lumpSumMode === opt.id ? C.pink + "60" : C.border}`,
                        borderRadius: 12, cursor: "pointer", textAlign: "left",
                        transition: "all 0.3s ease",
                        boxShadow: lumpSumMode === opt.id ? `0 0 0 3px ${C.pinkGlow}` : "none",
                      }}
                    >
                      <div style={{
                        fontSize: 13, color: lumpSumMode === opt.id ? C.pink : C.textSoft,
                        fontFamily: "inherit", fontWeight: lumpSumMode === opt.id ? 600 : 400,
                      }}>
                        {lumpSumMode === opt.id ? "● " : "○ "}{opt.label}
                      </div>
                      <div style={{ fontSize: 11, color: C.textDim, marginTop: 2, paddingLeft: 16 }}>
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </Field>
        </Reveal>

        {/* DC Pension Result Card */}
        {dcResult.potAtRetirement > 0 && (
          <Reveal delay={0.15} scale blur>
            <div style={{
              background: C.tealLight,
              border: `1px solid ${C.cyan}30`, borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              padding: "28px 28px", marginTop: 16, position: "relative", overflow: "hidden",
            }}>
              
              

              <div style={{ position: "relative", zIndex: 1 }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{
                      fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em",
                      fontFamily: "inherit", marginBottom: 10,
                    }}>Projected Pot at Retirement</div>
                    <div style={{
                      fontSize: 40, fontWeight: 700, fontFamily: "inherit",
                      color: C.cyan, letterSpacing: "-0.03em",
                    }}>
                      £<CountUp target={dcResult.potAtRetirement} />
                    </div>
                    <div style={{ fontSize: 13, color: C.textDim, marginTop: 8 }}>
                      In today's money · at age {retireAge} · {dcResult.yearsToRetirement} years from now
                    </div>
                  </div>
                  <div style={{
                    background: dcResult.potRunsOut && dcResult.potLastsUntilAge < 85 ? `${C.violet}20` : C.greenDim,
                    border: `1px solid ${dcResult.potRunsOut && dcResult.potLastsUntilAge < 85 ? C.violet + "30" : C.green + "30"}`,
                    borderRadius: 8, padding: "6px 14px", fontSize: 12,
                    color: dcResult.potRunsOut && dcResult.potLastsUntilAge < 85 ? C.violet : C.green,
                    fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: dcResult.potRunsOut && dcResult.potLastsUntilAge < 85 ? C.violet : C.green }} />
                    {dcResult.potRunsOut ? `Pot lasts until age ${dcResult.potLastsUntilAge}` : "Pot lasts past 100"}
                  </div>
                </div>

                {/* Detail cards */}
                <div style={{
                  display: "flex", gap: 16, marginTop: 20, paddingTop: 18,
                  borderTop: `1px solid ${C.border}`, flexWrap: "wrap",
                }}>
                  {lumpSumMode === "upfront" && (
                    <div style={{ flex: 1, minWidth: 130 }}>
                      <div style={{ fontSize: 11, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                        Upfront Lump Sum
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "inherit", color: C.green }}>
                        {formatCurrency(dcResult.upfrontLumpSum)}
                      </div>
                      <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>25% · tax-free cash at retirement</div>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <div style={{ fontSize: 11, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      Annual Drawdown
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "inherit", color: C.cyan }}>
                      {formatCurrency(dcResult.annualDrawdown)}
                    </div>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                      {formatCurrency(dcResult.monthlyDrawdown)}/month · to age {dcResult.planToAge}
                    </div>
                    {/* Implied withdrawal rate with warning if aggressive */}
                    <div style={{
                      fontSize: 11, marginTop: 4, fontFamily: "inherit",
                      color: dcResult.impliedDrawdownRate > 5 ? "#f59e0b" : C.textDim,
                    }}>
                      {dcResult.impliedDrawdownRate.toFixed(1)}% implied withdrawal rate
                      {dcResult.impliedDrawdownRate > 5 && " ⚠ above 5%"}
                    </div>
                  </div>
                  {lumpSumMode === "phased" && (
                    <div style={{ flex: 1, minWidth: 130 }}>
                      <div style={{ fontSize: 11, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                        Tax-Free / Taxable Split
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "inherit", color: C.green }}>
                        {formatCurrency(dcResult.annualTaxFree)} <span style={{ color: C.textDim, fontSize: 14, fontWeight: 400 }}>free</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                        {formatCurrency(dcResult.annualTaxable)} taxable · per year
                      </div>
                    </div>
                  )}
                  {lumpSumMode === "upfront" && (
                    <div style={{ flex: 1, minWidth: 130 }}>
                      <div style={{ fontSize: 11, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                        Pot After Lump Sum
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "inherit", color: C.text }}>
                        {formatCurrency(dcResult.potEnteringDrawdown)}
                      </div>
                      <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>75% remains invested</div>
                    </div>
                  )}
                </div>

                {/* Growth breakdown */}
                <div style={{
                  marginTop: 18, padding: "14px 16px", background: C.tealLight,
                  border: `1px solid ${C.cyan}15`, borderRadius: 8,
                  fontSize: 13, color: C.textDim, lineHeight: 1.6,
                }}>
                  <strong style={{ color: C.cyan }}>How it grows:</strong> Your current pot of {formatCurrency(parseFloat(dcPotValue) || 0)} plus {formatCurrency(Math.round(dcContribYoursMonthly + dcContribEmployerMonthly))}/month in contributions ({dcContribYoursPct}% + {dcContribEmployerPct}% of salary) over {dcResult.yearsToRetirement} years, with investment growth of {dcGrowthRate}% (adjusted for {inflationRate}% inflation), gives you {formatCurrency(dcResult.potAtRetirement)} in today's money.
                  {dcResult.investmentGrowth > 0 && (
                    <span> Of that, roughly {formatCurrency(dcResult.investmentGrowth)} comes from investment growth — that's compound interest working for you.</span>
                  )}
                </div>
              </div>
            </div>
          </Reveal>
        )}

        {/* DC Educational content */}
        <Reveal delay={0.3}>
          <LearnMore title="What is a Defined Contribution pension?">
            <p style={{ margin: "0 0 12px" }}>
              A <strong style={{ color: C.cyan }}>Defined Contribution (DC) pension</strong> is a pot of money that you (and usually your employer) pay into during your working life. The money is invested, and the pot grows over time. When you retire, you use the pot to fund your retirement income.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              The key thing to understand is that <strong style={{ color: C.text }}>the pot is yours, but its value depends on how much goes in and how well the investments perform</strong>. Unlike the State Pension (which is guaranteed by the government) or a Defined Benefit pension (which promises a specific income), a DC pension can go up or down. That's both the risk and the opportunity.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              Most workplace pensions in the UK are now DC pensions. By law, your employer must contribute at least 3% of your qualifying earnings, and you must contribute at least 5% (though some of that comes from tax relief). Many employers offer to "match" higher contributions — for example, if you put in 5%, they'll put in 5% too. This matching is effectively free money and is almost always worth maximising.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              Source: MoneyHelper — Defined contribution pensions
            </p>
          </LearnMore>

          <LearnMore title="What is drawdown and how does the 4% rule work?">
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>Drawdown</strong> (formally "flexi-access drawdown") means keeping your pension pot invested after retirement and withdrawing money from it as income. Your pot continues to grow (or shrink) based on investment performance, and you control how much you take and when.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              The <strong style={{ color: C.text }}>4% rule</strong> is a widely cited guideline that suggests withdrawing 4% of your pot per year gives you a good chance of the money lasting 30+ years. It comes from a 1994 US study by William Bengen. For example, a £300,000 pot at 4% gives £12,000/year.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>Important caveats:</strong> The 4% rule is a starting point, not a guarantee. It was based on US market data and doesn't account for UK-specific factors. Bad investment returns in your early retirement years can be devastating (this is called "sequence of returns risk"). Many financial planners suggest a more conservative 3–3.5% for longer retirements, or adjusting your withdrawals based on how the pot is performing.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              The alternative to drawdown is buying an <strong style={{ color: C.text }}>annuity</strong> — a guaranteed income for life from an insurance company. We'll add annuity comparison in a future session.
            </p>
          </LearnMore>

          <LearnMore title="What about the 25% tax-free cash?">
            <p style={{ margin: "0 0 12px" }}>
              When you access your DC pension (from age 55, rising to 57 from April 2028), up to <strong style={{ color: C.cyan }}>25% of what you withdraw can be taken tax-free</strong>. The maximum tax-free amount across all your pensions is capped at £268,275.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              There are two main ways to take your tax-free cash:
            </p>
            <p style={{ margin: "0 0 8px" }}>
              <strong style={{ color: C.text }}>Phased drawdown (recommended):</strong> You crystallise portions of your pot over time. Each time, 25% comes out tax-free and 75% enters drawdown. This is generally considered more tax-efficient because you can spread withdrawals across tax years to stay in lower tax bands, and the uncrystallised portion stays invested and grows within the pension tax wrapper.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.text }}>Upfront lump sum:</strong> You take the full 25% as a single lump sum at retirement. This gives you a large chunk of cash immediately, but the remaining 75% generates a smaller annual drawdown, and all future withdrawals are fully taxable.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>Why phased is usually better:</strong> By taking tax-free cash gradually, you keep more money growing inside your pension for longer. You also avoid a situation where you've used all your tax-free entitlement on day one and everything after is fully taxed. Most financial planners recommend the phased approach unless you have a specific need for a large lump sum (e.g. paying off a mortgage).
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              Source: MoneyHelper — Phased or partial pension drawdown; GOV.UK — Tax on your private pension
            </p>
          </LearnMore>

          <LearnMore title="When can I access my pension?">
            <p style={{ margin: "0 0 12px" }}>
              You can currently access your DC pension from <strong style={{ color: C.cyan }}>age 55</strong>. However, this is rising to <strong style={{ color: C.text }}>age 57 from 6 April 2028</strong>. Since you were born in 1994, you won't turn 55 until 2049, so the age-57 rule will apply to you — meaning the earliest you could access your pension is 2051.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              This is different from both your State Pension age (67) and your chosen retirement age. If you want to retire before 57, you'd need to fund those years entirely from ISAs, savings, or other non-pension sources.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>Be aware:</strong> Once you start taking taxable income from your pension (anything beyond the 25% tax-free lump sum), your annual allowance for future pension contributions drops from £60,000 to £10,000. This is called the Money Purchase Annual Allowance (MPAA). It's something to consider if you're thinking about accessing your pension while still working.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              Source: GOV.UK — Increasing Normal Minimum Pension Age; Finance Act 2022
            </p>
          </LearnMore>
        </Reveal>

        {/* ═══════ SECTION 4: ISA & SAVINGS ═══════ */}
        <Divider texture="dots" />
        <Reveal>
          <SectionLabel text="ISAs & Savings" />
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: "12px 0 8px", letterSpacing: "-0.02em" }}>ISAs & Savings</h2>
          <p style={{ color: C.textSoft, fontSize: 15, lineHeight: 1.6, marginBottom: 32, marginTop: 0 }}>
            Tax-free savings that can bridge the gap between early retirement and your State Pension.
            All ISA withdrawals are completely tax-free — no income tax, no capital gains tax, no dividend tax.
          </p>
        </Reveal>

        {/* ── Cash ISA ── */}
        <Reveal delay={0.05}>
          <div style={{
            background: `${C.card}80`, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: "20px 22px", marginBottom: 20,
          }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: C.green, marginBottom: 4,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
              Cash ISA
            </div>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 18, lineHeight: 1.5 }}>
              Safe and predictable — like a tax-free savings account. Your capital is protected, but returns are lower.
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field label="Current Balance" tip="Your total Cash ISA holdings across all providers.">
                  <CurrencyInput
                    value={cashIsaBalance}
                    onValueChange={setCashIsaBalance}
                  />
                </Field>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field label="Monthly Contribution">
                  <CurrencyInput
                    value={cashIsaMonthlyContrib}
                    onValueChange={setCashIsaMonthlyContrib}
                  />
                </Field>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field
                  label="Expected Return"
                  tip="Cash ISA rates are currently around 3.5–4.7% (March 2026), but rates change with the Bank of England base rate. Historically, average Cash ISA returns have been around 1–2% over the long term. Use a conservative figure for projections over decades."
                >
                  <TextInput
                    value={cashIsaGrowthRate}
                    onChange={e => setCashIsaGrowthRate(e.target.value.replace(/[^0-9.]/g, ""))}
                    suffix="% / yr"
                  />
                </Field>
              </div>
            </div>
          </div>
        </Reveal>

        {/* ── Stocks & Shares ISA ── */}
        <Reveal delay={0.12}>
          <div style={{
            background: `${C.card}80`, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: "20px 22px", marginBottom: 20,
          }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: C.violet, marginBottom: 4,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.violet }} />
              Stocks & Shares ISA
            </div>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 18, lineHeight: 1.5 }}>
              Higher long-term growth potential, but your investments can go up and down. Best held for 5+ years.
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field label="Current Balance" tip="Your total Stocks & Shares ISA holdings. Check your investment platform for the current value.">
                  <CurrencyInput
                    value={ssIsaBalance}
                    onValueChange={setSsIsaBalance}
                  />
                </Field>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field label="Monthly Contribution">
                  <CurrencyInput
                    value={ssIsaMonthlyContrib}
                    onValueChange={setSsIsaMonthlyContrib}
                  />
                </Field>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field
                  label="Expected Return"
                  tip="The average Stocks & Shares ISA has returned around 6–10% per year over the last decade, depending on the period. Over 20 years, the Barclays Equity Gilt Study shows equities have returned about 3% per year above inflation. 7% nominal (roughly 5% real) is a commonly used long-term assumption for a diversified portfolio."
                >
                  <TextInput
                    value={ssIsaGrowthRate}
                    onChange={e => setSsIsaGrowthRate(e.target.value.replace(/[^0-9.]/g, ""))}
                    suffix="% / yr"
                  />
                </Field>
              </div>
            </div>
          </div>
        </Reveal>

        {/* ── ISA total + annual allowance note ── */}
        <Reveal delay={0.15}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 16px", background: `${C.violet}08`, border: `1px solid ${C.violet}15`,
            borderRadius: 8, marginBottom: 20, flexWrap: "wrap", gap: 8,
          }}>
            <div style={{ fontSize: 13, color: C.textSoft }}>
              Combined monthly ISA contributions: <strong style={{ color: C.violet, fontFamily: "inherit" }}>{formatCurrency(Math.round(totalIsaMonthlyContrib))}/month</strong>
              <span style={{ color: C.textDim }}> ({formatCurrency(Math.round(totalIsaMonthlyContrib * 12))}/year)</span>
            </div>
            {totalIsaMonthlyContrib * 12 > 20000 && (
              <div style={{ fontSize: 12, color: C.red, fontFamily: "inherit" }}>
                Exceeds £20,000 annual ISA allowance
              </div>
            )}
          </div>
        </Reveal>

        {/* ─── ISA Results ─── */}
        {(totalIsaBalance > 0 || totalIsaMonthlyContrib > 0) && (
          <Reveal delay={0.15} scale blur>
            <div style={{
              background: `linear-gradient(135deg, ${C.violet}10, ${C.cyan}08)`,
              border: `1px solid ${C.violet}30`, borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              padding: "28px 28px", marginTop: 16, position: "relative", overflow: "hidden",
            }}>
              
              

              <div style={{ position: "relative", zIndex: 1 }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{
                      fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em",
                      fontFamily: "inherit", marginBottom: 10,
                    }}>ISA Pot at Retirement</div>
                    <div style={{
                      fontSize: 40, fontWeight: 700, fontFamily: "inherit",
                      color: C.violet, letterSpacing: "-0.03em",
                    }}>
                      £<CountUp target={isaResult.potAtRetirement} />
                    </div>
                    <div style={{ fontSize: 13, color: C.textDim, marginTop: 8 }}>
                      <span style={{ color: C.green }}>{formatCurrency(isaResult.cashIsaAtRetirement)} Cash</span>
                      {" · "}
                      <span style={{ color: C.violet }}>{formatCurrency(isaResult.ssIsaAtRetirement)} S&S</span>
                      {" · "}
                      {formatCurrency(isaResult.investmentGrowth)} growth
                    </div>
                  </div>
                  <div style={{
                    background: C.greenLight,
                    border: `1px solid ${C.green}30`,
                    borderRadius: 8, padding: "6px 14px", fontSize: 12,
                    color: C.green,
                    fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
                    100% Tax-Free
                  </div>
                </div>

                {/* Stats row */}
                <div style={{
                  display: "flex", gap: 24, marginTop: 20, paddingTop: 18,
                  borderTop: `1px solid ${C.border}`, flexWrap: "wrap",
                }}>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <div style={{ fontSize: 11, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      Annual Drawdown
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "inherit", color: C.text }}>
                      {formatCurrency(isaResult.annualDrawdown)}
                    </div>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                      {formatCurrency(isaResult.monthlyDrawdown)}/month · all tax-free
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 130 }}>
                    <div style={{ fontSize: 11, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      Pot Lasts Until
                    </div>
                    <div style={{
                      fontSize: 22, fontWeight: 700, fontFamily: "inherit",
                      color: isaResult.potRunsOut && isaResult.potLastsUntilAge < statePensionAge ? C.red : C.text,
                    }}>
                      Age {isaResult.potLastsUntilAge}{!isaResult.potRunsOut && "+"}
                    </div>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                      {isaResult.potRunsOut
                        ? `Runs out ${isaResult.potLastsUntilAge < statePensionAge
                            ? `${statePensionAge - isaResult.potLastsUntilAge} years before State Pension`
                            : isaResult.potLastsUntilAge >= statePensionAge
                              ? `after State Pension starts`
                              : ""}`
                        : "Still going at 100+"}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 130 }}>
                    <div style={{ fontSize: 11, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      Bridge Years
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "inherit", color: C.text }}>
                      {isaResult.bridgeYearsCovered} <span style={{ color: C.textDim, fontWeight: 400, fontSize: 14 }}>of {Math.max(0, statePensionAge - retireAge)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                      Years covered before SPA
                    </div>
                  </div>
                </div>

                {/* ISA drawdown insight */}
                {hasBridgeYears && (
                  <div style={{
                    marginTop: 20, padding: "14px 18px",
                    background: `${C.violet}08`, border: `1px solid ${C.violet}20`,
                    borderRadius: 12, fontSize: 13, color: C.textSoft, lineHeight: 1.65,
                  }}>
                    <strong style={{ color: C.cyan }}>Sustainable drawdown:</strong>{" "}
                    Your ISA provides {formatCurrency(isaResult.annualDrawdown)}/year tax-free, spread evenly to age {parseInt(planToAge) || 90}.
                    During the bridge years (age {retireAge}–{statePensionAge - 1}), this combines with your DC pension drawdown.
                    After State Pension starts at {statePensionAge}, your ISA continues as a tax-free top-up alongside your pension income.
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        )}

        {/* ISA Educational content */}
        <Reveal delay={0.3}>
          <LearnMore title="Why are ISAs so powerful in retirement?">
            <p style={{ margin: "0 0 12px" }}>
              ISAs are one of the most tax-efficient savings vehicles in the UK. The key advantage is simple: <strong style={{ color: C.cyan }}>everything that happens inside an ISA is completely invisible to the taxman</strong>.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              Specifically, money inside an ISA grows free of income tax (on interest and dividends) and free of capital gains tax (on investment growth). When you withdraw, there is no tax to pay — regardless of how much you take out. You don't even need to declare ISA income on your tax return.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              This is very different from pensions, where withdrawals (beyond the 25% tax-free lump sum) are taxed as income. And it's very different from general savings accounts, where interest above the Personal Savings Allowance is taxed.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.text }}>In retirement, this matters enormously.</strong> ISA withdrawals don't count towards your income for tax purposes. This means they don't push you into higher tax bands, they don't trigger the Personal Allowance taper (the hidden 60% tax trap above £100k), and they don't reduce your Personal Savings Allowance. Pension income does all of those things.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              Source: GOV.UK — Individual Savings Accounts; MoneyHelper — Stocks and shares ISAs
            </p>
          </LearnMore>

          <LearnMore title="Cash ISA vs Stocks & Shares ISA — which is better for retirement?">
            <p style={{ margin: "0 0 12px" }}>
              A <strong style={{ color: C.cyan }}>Cash ISA</strong> works like a tax-free savings account. You earn interest, and that interest is tax-free. The value of your savings can't go down (other than through inflation eroding purchasing power). It's safe and predictable.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              A <strong style={{ color: C.cyan }}>Stocks & Shares ISA</strong> holds investments — funds, shares, bonds. The value can go up and down, but historically, investments have significantly outperformed cash over long time periods (10+ years). All growth, dividends, and gains are tax-free.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.text }}>For retirement planning over decades, the difference is substantial.</strong> If you're 30 and retiring at 60, you have a 30-year investment horizon. Over that period, the compounding effect of higher returns from a Stocks & Shares ISA can mean a dramatically larger pot than a Cash ISA. That's why this tool defaults to a growth rate more typical of investment returns.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              However, as you get closer to retirement and start drawing down, many people move some or all of their ISA into cash or lower-risk investments. This protects against a market crash right when you need the money — a concept called "sequence of returns risk" that we'll cover in more detail later.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              The assumed growth rate in this tool applies to your ISA as a whole. If you hold a mix of cash and investments, use a blended rate.
            </p>
          </LearnMore>

          <LearnMore title="ISA allowance and upcoming rule changes">
            <p style={{ margin: "0 0 12px" }}>
              The current annual ISA allowance is <strong style={{ color: C.cyan }}>£20,000</strong> for the 2025/26 tax year. This is the maximum you can put across all your ISAs in a single tax year.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.text }}>Important change coming in April 2027:</strong> The government announced in the Autumn Budget 2025 that for people under 65, the Cash ISA contribution limit will be reduced to £12,000 per year. The overall £20,000 ISA allowance remains the same, but to use the full amount, under-65s will need to put at least £8,000 into Stocks & Shares or other non-cash ISAs. Additionally, transfers from Stocks & Shares ISAs into Cash ISAs will be restricted for under-65s.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              The government has confirmed the overall £20,000 ISA allowance will remain frozen until at least 2030/31.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>For this tool:</strong> The annual allowance doesn't directly affect our drawdown projections — it matters for how much you can contribute each year. If you're contributing the maximum and plan to continue doing so, keep the April 2027 changes in mind.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              Source: GOV.UK — Tax-free savings newsletter 19 (November 2025); GOV.UK — Individual Savings Accounts
            </p>
          </LearnMore>

          <LearnMore title="Using ISAs to bridge the gap to State Pension">
            <p style={{ margin: "0 0 12px" }}>
              If you plan to retire before your State Pension age ({statePensionAge}), you'll have a gap of {Math.max(0, statePensionAge - retireAge)} years where the State Pension isn't paying out. During these <strong style={{ color: C.cyan }}>"bridge years"</strong>, you need other income sources.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              ISAs can be ideal for this because: they're accessible at any age (unlike pensions, which require you to be 55/57+); withdrawals are completely tax-free; and you have total flexibility over how much you take and when.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              A common strategy is to use ISA savings specifically to cover the bridge years, preserving your DC pension pot for later. This works well because: your DC pot stays invested and growing for longer; once the State Pension kicks in, you need less from your DC pot; and you've used tax-free ISA income during the years when you'd otherwise be drawing down taxable pension income.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              However, the "right" strategy depends on your specific circumstances — tax bands, pot sizes, and how long each pot needs to last. We'll add detailed drawdown strategy comparison in a later session.
            </p>
          </LearnMore>

          <LearnMore title="ISAs vs Pensions — a key difference you should know">
            <p style={{ margin: "0 0 12px" }}>
              Pensions and ISAs are both tax-advantaged, but they work in opposite ways:
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>Pensions:</strong> Tax relief on the way IN (contributions reduce your tax bill), but taxed on the way OUT (withdrawals are income-taxed, apart from the 25% tax-free lump sum). Your money is also locked away until age 55/57.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.violet }}>ISAs:</strong> No tax relief on the way IN (you contribute from already-taxed income), but completely tax-free on the way OUT. And you can access the money whenever you want.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.text }}>The practical implication:</strong> For retirement planning, you generally want both. Pensions are usually better value if your employer matches contributions (that's free money), and the upfront tax relief is valuable, especially for higher-rate taxpayers. ISAs provide flexibility and tax-free income in retirement. The optimal split depends on your tax band, employer contributions, and when you need access to the money.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              Note: ISAs do count as part of your estate for inheritance tax, whereas pensions usually do not (if you die before 75). This is another factor in the pension-vs-ISA decision.
            </p>
          </LearnMore>
        </Reveal>

        {/* ═══════ SECTION 5: GIA ═══════ */}
        <Divider  />
        <Reveal>
          <SectionLabel text="General Investments" />
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: "12px 0 8px", letterSpacing: "-0.02em" }}>General Investment Account</h2>
          <p style={{ color: C.textSoft, fontSize: 15, lineHeight: 1.6, marginBottom: 32, marginTop: 0 }}>
            Investments outside of pensions and ISAs. Less tax-efficient, but no contribution limits or access restrictions.
          </p>
        </Reveal>

        <Reveal delay={0.08} direction="right">
          <Field
            label="Current GIA Balance"
            tip="The total current value of your general investment accounts — anything invested outside of pensions and ISAs. This includes stocks and shares accounts, investment platforms, and similar. Set to 0 if you don't have any."
          >
            <CurrencyInput value={giaBalance} onValueChange={setGiaBalance} />
          </Field>
        </Reveal>

        <Reveal delay={0.16} direction="right">
          <Field
            label="Monthly GIA Contribution"
            tip="How much you add to your general investments each month, after pension and ISA contributions. This is money from your post-tax income."
          >
            <CurrencyInput value={giaMonthlyContrib} onValueChange={setGiaMonthlyContrib} suffix="/ month" />
          </Field>
        </Reveal>

        <Reveal delay={0.24} direction="right">
          <Field
            label="Assumed Growth Rate"
            tip="Expected annual growth rate for your GIA investments. This should reflect your investment mix. 5% is a common assumption for a balanced portfolio. Growth in a GIA is subject to Capital Gains Tax when you sell — unlike ISAs and pensions where growth is tax-free."
          >
            <TextInput
              value={giaGrowthRate}
              onChange={e => setGiaGrowthRate(e.target.value.replace(/[^0-9.]/g, ""))}
              suffix="% / year"
            />
          </Field>
        </Reveal>

        {/* GIA result card — only show if there's a balance or contributions */}
        {((parseFloat(giaBalance) || 0) > 0 || (parseFloat(giaMonthlyContrib) || 0) > 0) && (
          <Reveal delay={0.3} scale blur>
            <div style={{
              background: C.amberLight,
              border: `1px solid #f59e0b30`, borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              padding: "28px 28px", marginTop: 8, position: "relative", overflow: "hidden",
            }}>
              
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "inherit", marginBottom: 10 }}>
                      GIA Pot at Retirement
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "inherit", color: C.amber, letterSpacing: "-0.03em" }}>
                      £<CountUp target={giaResult.potAtRetirement} />
                    </div>
                    <div style={{ fontSize: 13, color: C.textDim, marginTop: 8 }}>
                      {formatCurrency(giaResult.totalContributed)} contributed · {formatCurrency(giaResult.investmentGrowth)} growth
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "inherit", marginBottom: 10 }}>
                      Sustainable Drawdown
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "inherit", color: C.text }}>
                      {formatCurrency(giaResult.annualDrawdown)}<span style={{ fontSize: 14, fontWeight: 400, color: C.textDim }}>/yr</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>
                      ~{formatCurrency(Math.round(giaResult.annualTaxableGain))}/yr taxable gain (subject to CGT)
                    </div>
                  </div>
                </div>

                <div style={{
                  marginTop: 16, padding: "12px 16px", background: C.amberLight,
                  border: `1px solid #f59e0b15`, borderRadius: 8,
                  fontSize: 12, color: C.textDim, lineHeight: 1.6,
                }}>
                  Unlike ISA withdrawals, GIA withdrawals trigger Capital Gains Tax on the growth portion.
                  With an annual CGT exemption of {formatCurrency(TAX_CONFIG.capitalGainsTax.annualExemptAmount)},
                  gains above that are taxed at {(TAX_CONFIG.capitalGainsTax.basicRate * 100)}% (basic rate)
                  or {(TAX_CONFIG.capitalGainsTax.higherRate * 100)}% (higher rate).
                  Of each {formatCurrency(giaResult.annualDrawdown)} withdrawal,
                  ~{(giaResult.gainRatio * 100).toFixed(0)}% is taxable gain and ~{(giaResult.costBasisRatio * 100).toFixed(0)}% is return of your original money.
                </div>
              </div>
            </div>
          </Reveal>
        )}

        <Reveal delay={0.35}>
          <LearnMore title="What is a General Investment Account?">
            <p style={{ margin: "0 0 12px" }}>
              A <strong style={{ color: C.cyan }}>General Investment Account (GIA)</strong> is simply any investment account that isn't inside a tax wrapper like an ISA or pension. It's sometimes called a "taxable brokerage account" or just a "dealing account."
            </p>
            <p style={{ margin: "0 0 12px" }}>
              GIAs have <strong style={{ color: C.text }}>no contribution limits</strong> (unlike ISAs at £{TAX_CONFIG.isaAllowance.annualAllowance.toLocaleString()}/year) and <strong style={{ color: C.text }}>no access restrictions</strong> (unlike pensions locked until 57/58). But the trade-off is that growth is taxable.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>How GIA tax works:</strong> When you sell investments for more than you paid, the profit (the "gain") is subject to Capital Gains Tax. You get a £{TAX_CONFIG.capitalGainsTax.annualExemptAmount.toLocaleString()} annual exempt amount — gains up to this are tax-free. Above that, you pay {(TAX_CONFIG.capitalGainsTax.basicRate * 100)}% (basic rate) or {(TAX_CONFIG.capitalGainsTax.higherRate * 100)}% (higher rate).
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>Why accumulation funds matter:</strong> This tool assumes your GIA investments are in <strong style={{ color: C.text }}>accumulation funds</strong>, which reinvest dividends automatically within the fund. This means you only trigger CGT when you sell — there's no annual dividend tax. If you hold income-paying investments (which distribute dividends to you), the tax treatment is different and potentially less favourable. The dividend allowance is only £500/year, with rates of 8.75% to 39.35%.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.text }}>Practical tip:</strong> Most financial guidance suggests filling your ISA and pension allowances before using a GIA. A GIA is useful when you've maxed out your tax-advantaged wrappers, or when you need flexibility that pensions can't offer.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              Source: GOV.UK — Capital gains tax rates and allowances ({TAX_CONFIG.year})
            </p>
          </LearnMore>
        </Reveal>

        </>)}

        {/* ═══════════════════════════════════════════════ */}
        {/* ═══════ TAB 2: MY TRAJECTORY ═════════════════ */}
        {/* ═══════════════════════════════════════════════ */}
        {activeTab === "trajectory" && (<>

        {/* ═══════════════════════════════════════════════ */}
        {/* ═══════ COMBINED RESULTS ═══════════════════ */}
        {/* ═══════════════════════════════════════════════ */}
        <Divider  />
        <Reveal>
          <div style={{ position: "relative", marginBottom: 24 }}>
            <div style={{ position: "relative", zIndex: 1 }}>
              <SectionLabel text="Your Projection" />
              <h2 style={{ fontSize: 28, fontWeight: 900, margin: "12px 0 8px", letterSpacing: "-0.02em" }}>
                Combined Retirement Income
              </h2>
              <p style={{ color: C.textSoft, fontSize: 15, lineHeight: 1.6, marginBottom: 0, marginTop: 0 }}>
                All your income sources combined — State Pension, DC pension drawdown, and ISA withdrawals.
              </p>
            </div>
          </div>
        </Reveal>

        {/* ═══════ ESTIMATED NET TAKE-HOME (with full tax engine) ═══════ */}
        {dcResult.potAtRetirement > 0 && (
          <Reveal delay={0.25} scale blur>
            <div style={{
              marginTop: 24, borderRadius: 16, overflow: "hidden",
              border: `2px solid ${C.green}40`,
              background: C.greenLight,
              position: "relative",
            }}>
              {/* Top accent bar */}
              <div style={{
                height: 3,
                background: C.green,
              }} />
              <div style={{ padding: "28px 28px", position: "relative" }}>
                
                

                <div style={{
                  fontSize: 11, color: C.green, textTransform: "uppercase", letterSpacing: "0.12em",
                  fontFamily: "inherit", marginBottom: 20,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  Estimated Annual Take-Home
                  <Tip text="Uses 2025/26 HMRC income tax rates including Personal Allowance tapering. ISA withdrawals are completely tax-free and don't count as taxable income. The 25% tax-free portion of pension drawdown (phased) is also excluded from taxable income." />
                </div>

                <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                  {/* Pre-State Pension — only shown if retiring before SPA */}
                  {hasBridgeYears && (
                    <>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 13, color: C.textSoft, marginBottom: 8 }}>
                        Before State Pension <span style={{ fontFamily: "inherit", fontSize: 11, color: C.textDim }}>(age {retireAge}–{statePensionAge - 1})</span>
                      </div>
                      <div style={{
                        fontSize: 38, fontWeight: 700, fontFamily: "inherit",
                        color: C.green, letterSpacing: "-0.03em", lineHeight: 1,
                      }}>
                        £<CountUp target={preSPTotalNet} />
                      </div>
                      <div style={{ fontSize: 13, color: C.textDim, marginTop: 8, fontFamily: "inherit" }}>
                        {formatCurrency(Math.round(preSPTotalNet / 12))}/month
                      </div>
                      <div style={{ fontSize: 12, color: C.textDim, marginTop: 4, lineHeight: 1.5 }}>
                        DC drawdown: {formatCurrency(preSPNetFromDC)} net
                        {preSPTaxResult.totalTax > 0 && (
                          <span> · {formatCurrency(preSPTaxResult.totalTax)} tax ({(preSPTaxResult.effectiveRate * 100).toFixed(1)}%)</span>
                        )}
                        {preSPTaxResult.totalTax === 0 && <span> · no tax (within Personal Allowance)</span>}
                        <br />
                        <span style={{ color: C.violet }}>ISA: {formatCurrency(isaResult.annualDrawdown)} tax-free</span>
                      </div>
                    </div>
                    {/* Divider */}
                    <div style={{ width: 1, background: `${C.green}30`, alignSelf: "stretch" }} />
                    </>
                  )}

                  {/* Post-State Pension (or "At Retirement" if no bridge years) */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 13, color: C.textSoft, marginBottom: 8 }}>
                      {hasBridgeYears ? "After State Pension" : "At Retirement"} <span style={{ fontFamily: "inherit", fontSize: 11, color: C.textDim }}>({hasBridgeYears ? `age ${statePensionAge}+` : `age ${retireAge}+`})</span>
                    </div>
                    <div style={{
                      fontSize: 38, fontWeight: 700, fontFamily: "inherit",
                      color: C.green, letterSpacing: "-0.03em", lineHeight: 1,
                    }}>
                      £<CountUp target={postSPNetTotal} />
                    </div>
                    <div style={{ fontSize: 13, color: C.textDim, marginTop: 8, fontFamily: "inherit" }}>
                      {formatCurrency(Math.round(postSPNetTotal / 12))}/month
                    </div>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 4, lineHeight: 1.5 }}>
                      DC + State Pension · {formatCurrency(postSPTaxResult.totalTax)} tax ({(postSPTaxResult.effectiveRate * 100).toFixed(1)}%)
                      <br />
                      <span style={{ color: C.textDim }}>
                        State Pension uses {formatCurrency(spPAUsage)} of your £{(TAX_CONFIG.incomeTax.personalAllowance).toLocaleString("en-GB")} allowance
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tax efficiency insight — contextual message based on their situation */}
                <div style={{
                  marginTop: 20, padding: "14px 18px",
                  background: C.greenLight, border: `1px solid ${C.green}15`,
                  borderRadius: 12, fontSize: 13, color: C.textSoft, lineHeight: 1.65,
                }}>
                  {(() => {
                    // Generate contextual tax insight
                    if (postSPTaxResult.isPATapered) {
                      return (
                        <>
                          <strong style={{ color: C.red }}>Personal Allowance taper active:</strong>{" "}
                          Your taxable income of {formatCurrency(postSPTaxResult.grossIncome)} is above £100,000, so your Personal Allowance is reduced
                          by {formatCurrency(postSPTaxResult.taperReduction)} to {formatCurrency(postSPTaxResult.personalAllowance)}.
                          This creates an effective marginal tax rate of 60% in the £100k–£125,140 band.
                          Consider whether drawing less from your pension and using ISA savings instead could keep you below this threshold.
                        </>
                      );
                    }
                    if (postSPTaxResult.higherRateAmount > 0) {
                      return (
                        <>
                          <strong style={{ color: C.amber }}>Higher rate tax applies:</strong>{" "}
                          {formatCurrency(postSPTaxResult.higherRateAmount)} of your retirement income falls in the 40% higher rate band.
                          Drawing less from your DC pension and supplementing with tax-free ISA withdrawals could reduce how much income crosses into the higher rate band.
                        </>
                      );
                    }
                    if (hasBridgeYears && paRemainingAfterSP > 2000 && preSPTaxResult.totalTax === 0) {
                      return (
                        <>
                          <strong style={{ color: C.green }}>Tax-efficient position:</strong>{" "}
                          Before State Pension age, your DC drawdown falls within your Personal Allowance — meaning no income tax.
                          After the State Pension starts, you still have {formatCurrency(paRemainingAfterSP)} of unused allowance to use against DC drawdown before tax kicks in.
                        </>
                      );
                    }
                    if (paRemainingAfterSP < 1000 && paRemainingAfterSP >= 0) {
                      return (
                        <>
                          <strong style={{ color: C.cyan }}>State Pension nearly fills your allowance:</strong>{" "}
                          Your State Pension of {formatCurrency(spResult.annualAmount)}/year uses {formatCurrency(spPAUsage)} of your £{TAX_CONFIG.incomeTax.personalAllowance.toLocaleString("en-GB")} Personal Allowance, leaving only {formatCurrency(paRemainingAfterSP)} tax-free.
                          Almost every pound of DC pension drawdown after State Pension age will be taxed at {(TAX_CONFIG.incomeTax.basicRate * 100).toFixed(0)}% or more.
                          This is why ISA savings are so valuable — they don't add to your taxable income.
                        </>
                      );
                    }
                    return (
                      <>
                        <strong style={{ color: C.cyan }}>Tax note:</strong>{" "}
                        Your State Pension uses {formatCurrency(spPAUsage)} of your Personal Allowance.
                        DC pension drawdown above the remaining {formatCurrency(paRemainingAfterSP)} is taxed at the basic rate ({(TAX_CONFIG.incomeTax.basicRate * 100).toFixed(0)}%).
                        ISA withdrawals are completely tax-free and don't affect your tax position at all.
                      </>
                    );
                  })()}
                </div>

                <div style={{
                  marginTop: 12, fontSize: 11, color: C.textDim,
                  fontStyle: "italic", lineHeight: 1.5, opacity: 0.7,
                }}>
                  {TAX_CONFIG.year} HMRC rates · includes Personal Allowance tapering · ISA income is tax-free
                </div>
              </div>
            </div>
          </Reveal>
        )}

        {/* ═══════ TAX BREAKDOWN PANEL ═══════ */}
        {dcResult.potAtRetirement > 0 && (
          <Reveal delay={0.3} scale>
            <TaxBreakdownPanel
              preSPTax={preSPTaxResult}
              postSPTax={postSPTaxResult}
              isaIncome={isaResult.annualDrawdown}
              statePensionAnnual={spResult.annualAmount}
              retireAge={retireAge}
              statePensionAge={statePensionAge}
              paRemainingAfterSP={paRemainingAfterSP}
              lumpSumMode={lumpSumMode}
              hasBridgeYears={hasBridgeYears}
              giaDrawdown={giaResult.annualDrawdown}
              giaTaxableGain={giaResult.annualTaxableGain}
              preSPGiaDrawdown={giaResult.annualDrawdown}
              preSPGiaTaxableGain={giaResult.annualTaxableGain}
            />
          </Reveal>
        )}

        {/* ═══════ TAX EDUCATIONAL CONTENT ═══════ */}
        <Reveal delay={0.35}>
          <LearnMore title="How is pension income taxed in retirement?">
            <p style={{ margin: "0 0 12px" }}>
              Pension income is taxed as earned income — just like a salary. This applies to both your State Pension and any income you draw from a DC pension (beyond the 25% tax-free lump sum).
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>The key thing to understand:</strong> Your State Pension, DC pension drawdown, and any other taxable income are all added together to determine your total taxable income. Tax is then calculated on the combined amount using the standard income tax bands. This means adding a second income source can push the total into a higher band.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.text }}>State Pension:</strong> Although no tax is deducted when the State Pension is paid to you, it is still fully taxable. If you have other income, HMRC collects the tax by adjusting your tax code on that other income. If State Pension is your only income, you may not owe any tax (since the full State Pension is below the Personal Allowance).
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.text }}>DC pension drawdown:</strong> Your pension provider deducts tax at source under PAYE when you take a drawdown payment. If you're using phased withdrawals, 25% of each withdrawal is tax-free, and 75% is taxed as income.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              Source: GOV.UK — Tax when you get a pension; GOV.UK — Income Tax rates and Personal Allowances
            </p>
          </LearnMore>

          <LearnMore title="The Personal Allowance taper — the hidden 60% tax trap">
            <p style={{ margin: "0 0 12px" }}>
              For most people, the first £{TAX_CONFIG.incomeTax.personalAllowance.toLocaleString("en-GB")} of income is tax-free. But if your total income exceeds £100,000, you start losing this allowance — at a rate of <strong style={{ color: C.red }}>£1 lost for every £2 earned above £100,000</strong>.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              By the time your income reaches £125,140, your Personal Allowance is completely gone. In this band, the effective marginal tax rate is <strong style={{ color: C.red }}>60%</strong> — you're paying 40% income tax PLUS effectively losing 20% because income that was previously tax-free is now being taxed.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>Why this matters for retirement:</strong> If you have a large DC pension pot and take big drawdowns, you could accidentally push yourself into this trap. The solution is to control how much taxable income you take each year. Using ISA savings to supplement pension income can keep your taxable income below £100,000.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.text }}>Pension contributions can also help:</strong> If you're still working and earning above £100,000, making pension contributions reduces your "adjusted net income" — potentially pulling your income back below the £100,000 threshold and restoring your Personal Allowance. This is one of the most tax-efficient moves available to higher earners.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              Source: GOV.UK — Income Tax rates and Personal Allowances; GOV.UK — Adjusted net income
            </p>
          </LearnMore>

          <LearnMore title="Tips for reducing your effective tax rate in retirement">
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>1. Use your Personal Allowance wisely.</strong> If your State Pension nearly fills your PA (as it does for most people on the full new State Pension), any DC drawdown on top is immediately taxed. Consider whether you need that DC income, or whether ISA savings could cover it tax-free.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>2. Draw from ISAs before pensions (when it makes sense).</strong> ISA withdrawals don't count as taxable income. Using ISAs to bridge the gap before State Pension age — or to top up income after — can keep your total taxable income in a lower band.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>3. Stay below tax band boundaries.</strong> If your projected taxable income is just above £50,270 (the higher rate threshold), reducing DC drawdown by a small amount could save 20p in tax on every pound you shift out of the higher rate band.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>4. Absolutely avoid the £100k–£125,140 trap.</strong> If you can keep taxable income below £100,000, do. The 60% effective rate in this band is punishing, and it's usually possible to avoid by taking less from your pension and more from ISAs.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>5. Take advantage of the 25% tax-free pension lump sum.</strong> Whether you take it upfront or phased, this reduces the taxable portion of your pension withdrawals. The "phased" approach is often more tax-efficient because it spreads the tax-free benefit across your whole retirement rather than front-loading it.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              Note: These are general planning considerations, not personal financial advice. The optimal strategy depends on your individual circumstances. Consider consulting a qualified financial adviser.
            </p>
          </LearnMore>
        </Reveal>

        {/* ═══════ RETIREMENT INCOME CHART ═══════ */}
        {unifiedTimeline.length > 0 && (
          <Reveal delay={0.35} scale>
            <div style={{
              marginTop: 24, background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 16, padding: "28px 28px", position: "relative", overflow: "hidden",
            }}>
              
              

              <div style={{ position: "relative", zIndex: 1 }}>
                {/* Header with gross/net toggle */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Retirement Income Timeline</div>
                    <div style={{ fontSize: 13, color: C.textDim }}>
                      {chartMode === "net" ? "After-tax" : "Before-tax"} annual income by age · retiring at {retireAge} · in today's money
                    </div>
                  </div>
                  {/* Gross / Net toggle */}
                  <div style={{ display: "flex", gap: 2, background: C.bg, borderRadius: 8, padding: 3, border: `1px solid ${C.border}` }}>
                    {[
                      { id: "net", label: "Net (after tax)" },
                      { id: "gross", label: "Gross" },
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => setChartMode(m.id)}
                        style={{
                          padding: "6px 12px", borderRadius: 6, border: "none",
                          background: chartMode === m.id ? C.card : "transparent",
                          color: chartMode === m.id ? C.pink : C.textDim,
                          fontSize: 11, fontFamily: "inherit",
                          cursor: "pointer", transition: "all 0.3s ease",
                        }}
                      >{m.label}</button>
                    ))}
                  </div>
                </div>

                {/* Legend — ordered by tax efficiency (matches bar stack, bottom to top) */}
                <div style={{ display: "flex", gap: 16, marginBottom: 16, marginTop: 16, flexWrap: "wrap" }}>
                  {[
                    { c: C.chartYellow, l: "ISA (tax-free)" },
                    { c: C.chartCoral, l: "DC Pension" },
                    { c: C.chartBlue, l: "State Pension" },
                    ...((giaResult.annualDrawdown > 0) ? [{ c: C.chartAmber, l: "GIA (CGT)" }] : []),
                    ...(chartMode === "gross" ? [{ c: C.chartRed, l: "Tax" }] : []),
                  ].map(({ c, l }) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: 3,
                        background: l === "Tax" ? `${c}40` : c,
                        border: l === "Tax" ? `1px solid ${c}60` : "none",
                      }} />
                      <span style={{ fontSize: 12, color: C.textDim, fontFamily: "inherit" }}>{l}</span>
                    </div>
                  ))}
                </div>

                {/* Chart with Y-axis */}
                {(() => {
                  // Use the unified timeline — it has proper tax calculations per year
                  const showNet = chartMode === "net";

                  // Calculate bar heights based on mode
                  const getBarValues = (d) => {
                    if (showNet) {
                      return {
                        isa: d.isaNet,
                        dc: d.dcNet,
                        sp: d.spNet,
                        gia: d.giaNet || 0,
                        tax: 0,
                        total: d.totalNet,
                      };
                    } else {
                      return {
                        isa: d.isaGross,
                        dc: d.dcGross,
                        sp: d.spGross,
                        gia: d.giaGross || 0,
                        tax: d.tax,
                        total: d.totalGross,
                      };
                    }
                  };

                  const maxIncome = Math.max(...unifiedTimeline.map(d => getBarValues(d).total), 1);
                  const targetIncomeParsed = parseFloat(targetIncome) || 0;
                  const chartHeight = 240;
                  const barAreaHeight = chartHeight - 30;

                  // Y-axis: pick nice round numbers — with safety floor for zero/tiny incomes
                  const effectiveMax = Math.max(maxIncome, targetIncomeParsed, 5000); // floor of £5k so axis is always sensible
                  const rawStep = effectiveMax * 1.1 / 4;
                  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 1))));
                  const niceStep = Math.ceil(rawStep / magnitude) * magnitude;
                  const yMax = Math.max(niceStep * 4, 1);
                  const yTicks = [0, niceStep, niceStep * 2, niceStep * 3, niceStep * 4];

                  const barCount = unifiedTimeline.length;
                  const labelEvery = barCount <= 20 ? 1 : barCount <= 35 ? 2 : 5;

                  return (
                    <div style={{ display: "flex", width: "100%" }}>
                      {/* Y-axis labels */}
                      <div style={{
                        width: 48, flexShrink: 0, height: chartHeight,
                        display: "flex", flexDirection: "column", justifyContent: "space-between",
                        paddingBottom: 30,
                      }}>
                        {[...yTicks].reverse().map((val, i) => (
                          <div key={i} style={{
                            fontSize: 10, color: C.textDim, fontFamily: "inherit",
                            textAlign: "right", paddingRight: 8, lineHeight: 1,
                          }}>
                            £{val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                          </div>
                        ))}
                      </div>

                      {/* Chart area */}
                      <div style={{ flex: 1, height: chartHeight, position: "relative" }}>
                        {/* Horizontal grid lines */}
                        {yTicks.slice(1).map((val, i) => (
                          <div key={i} style={{
                            position: "absolute",
                            bottom: 30 + (val / yMax) * barAreaHeight,
                            left: 0, right: 0, height: 1,
                            background: C.gridLineFaint, opacity: 0.6,
                          }} />
                        ))}

                        {/* Target income line */}
                        {targetIncomeParsed > 0 && (
                          <div style={{
                            position: "absolute",
                            bottom: targetIncomeParsed <= yMax
                              ? 30 + (targetIncomeParsed / yMax) * barAreaHeight
                              : 30 + barAreaHeight - 2, /* clamp to top of chart */
                            left: 0, right: 0, zIndex: 10,
                          }}>
                            {/* The line itself — thicker, more opaque */}
                            <div style={{
                              position: "absolute", left: 0, right: 0, top: 0,
                              borderTop: `2px dashed ${C.pink}`,
                            }} />
                            {/* Label with background pill so it's readable over bars */}
                            <span style={{
                              position: "absolute", right: 4, top: -22,
                              fontSize: 10, color: C.pink, fontWeight: 600,
                              fontFamily: "inherit",
                              background: C.card, padding: "2px 8px",
                              borderRadius: 4, border: `1px solid ${C.pink}40`,
                            }}>£{(targetIncomeParsed / 1000).toFixed(0)}k target{targetIncomeParsed > yMax ? " ▲" : ""}</span>
                          </div>
                        )}

                        {/* Bars */}
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0, height: chartHeight,
                          display: "flex", alignItems: "flex-end", gap: 1,
                          paddingBottom: 30,
                        }}>
                          {unifiedTimeline.map((d, i) => {
                            const vals = getBarValues(d);
                            const isaH = Math.max((vals.isa / yMax) * barAreaHeight, 0);
                            const dcH = Math.max((vals.dc / yMax) * barAreaHeight, 0);
                            const spH = Math.max((vals.sp / yMax) * barAreaHeight, 0);
                            const giaH = Math.max((vals.gia / yMax) * barAreaHeight, 0);
                            const taxH = !showNet ? Math.max((vals.tax / yMax) * barAreaHeight, 0) : 0;
                            const totalH = isaH + dcH + spH + giaH + taxH;
                            const isSPA = d.age === statePensionAge;
                            const isPotEnd = dcResult.potRunsOut && d.age === dcResult.potLastsUntilAge;

                            return (
                              <div key={d.age} style={{
                                flex: 1, display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "flex-end",
                                height: barAreaHeight, position: "relative",
                              }}>
                                {/* SPA vertical marker */}
                                {isSPA && (
                                  <div style={{
                                    position: "absolute", top: 0, bottom: 0, left: "50%", width: 1,
                                    borderLeft: `1px dashed ${C.chartBlue}80`, zIndex: 0,
                                  }} />
                                )}
                                {/* Pot runs out marker */}
                                {isPotEnd && (
                                  <div style={{
                                    position: "absolute", top: 0, bottom: 0, left: "50%", width: 1,
                                    borderLeft: `1px dashed ${C.red}60`, zIndex: 0,
                                  }} />
                                )}

                                {/* Stacked bar — most tax-efficient at bottom, least at top */}
                                <div style={{ width: "80%", display: "flex", flexDirection: "column", zIndex: 1 }}>
                                  {[
                                    taxH > 0 && { h: taxH, bg: `${C.chartRed}60`, border: `1px solid ${C.chartRed}80`, label: "Tax", val: vals.tax, color: C.chartRed, radius: "2px 2px 0 0" },
                                    giaH > 0 && { h: giaH, bg: C.chartAmber, label: "GIA", val: vals.gia, color: C.chartAmber },
                                    spH > 0 && { h: spH, bg: C.chartBlue, label: "State Pension", val: vals.sp, color: C.chartBlue },
                                    dcH > 0 && { h: dcH, bg: C.chartCoral, label: "DC Pension", val: vals.dc, color: C.chartCoral },
                                    isaH > 0 && { h: isaH, bg: C.chartYellow, label: "ISA", val: vals.isa, color: C.chartYellow, radius: "0 0 2px 2px" },
                                  ].filter(Boolean).map((seg, si, arr) => (
                                    <div
                                      key={seg.label}
                                      onMouseEnter={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setChartTooltip({
                                          age: d.age,
                                          label: seg.label,
                                          value: seg.val,
                                          color: seg.color,
                                          total: showNet ? d.totalNet : d.totalGross,
                                          x: rect.left + rect.width / 2,
                                          y: rect.top - 8,
                                        });
                                      }}
                                      onMouseLeave={() => setChartTooltip(null)}
                                      style={{
                                        height: seg.h, background: seg.bg, minHeight: 1,
                                        borderRadius: si === 0 && arr.length > 1 ? "2px 2px 0 0" : si === arr.length - 1 && arr.length > 1 ? "0 0 2px 2px" : arr.length === 1 ? "2px" : "0",
                                        borderTop: seg.border || "none",
                                        cursor: "crosshair",
                                        transition: "opacity 0.15s",
                                        opacity: chartTooltip && chartTooltip.age === d.age && chartTooltip.label !== seg.label ? 0.5 : 1,
                                      }}
                                    />
                                  ))}
                                  {totalH === 0 && (
                                    <div style={{ height: 1, background: C.border, borderRadius: 1 }} />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Age labels row */}
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0, height: 28,
                          display: "flex", gap: 1,
                        }}>
                          {unifiedTimeline.map((d, i) => {
                            const isSPA = d.age === statePensionAge;
                            const isPotEnd = dcResult.potRunsOut && d.age === dcResult.potLastsUntilAge;
                            const showLabel = (i % labelEvery === 0) || isSPA || isPotEnd;
                            return (
                              <div key={d.age} style={{
                                flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end",
                              }}>
                                {showLabel && (
                                  <span style={{
                                    fontSize: 9,
                                    color: isPotEnd ? C.red : isSPA ? C.chartBlue : C.textDim,
                                    fontFamily: "inherit",
                                    fontWeight: isSPA || isPotEnd ? 700 : 400,
                                  }}>{d.age}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Chart summary — pre-SP and post-SP tax impact */}
                {(() => {
                  const preYear = unifiedTimeline.find(y => y.age === retireAge);
                  const postYear = unifiedTimeline.find(y => y.age === statePensionAge);
                  if (!preYear && !postYear) return null;

                  const SummaryRow = ({ label, ages, year }) => {
                    if (!year || year.totalGross === 0) return null;
                    return (
                      <div style={{ flex: 1, minWidth: 220, padding: "10px 14px", background: C.tealLight, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>
                          {label} <span style={{ opacity: 0.6 }}>({ages})</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.textSoft, lineHeight: 1.7, fontFamily: "inherit" }}>
                          Gross {formatCurrency(Math.round(year.totalGross))}
                          → tax {formatCurrency(Math.round(year.tax))}
                          → net <span style={{ color: C.green, fontWeight: 600 }}>{formatCurrency(Math.round(year.totalNet))}</span>
                          <br />
                          Effective rate: {(year.effectiveRate * 100).toFixed(1)}%
                          {" · "}marginal: {(year.marginalRate * 100).toFixed(0)}%
                          {year.isPATapered && (
                            <span style={{ color: C.red, fontWeight: 600 }}> · PA taper!</span>
                          )}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div style={{
                      marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap",
                      padding: "4px", background: `${C.bgAlt}`, borderRadius: 12,
                      border: `1px solid ${C.border}`,
                    }}>
                      {retireAge < statePensionAge && (
                        <SummaryRow label="Before State Pension" ages={`age ${retireAge}–${statePensionAge - 1}`} year={preYear} />
                      )}
                      <SummaryRow label="After State Pension" ages={`age ${statePensionAge}+`} year={postYear} />
                    </div>
                  );
                })()}

                {/* Bridge years callout */}
                {retireAge < statePensionAge && (
                  <div style={{
                    marginTop: 12, padding: "14px 18px",
                    background: C.blueLight, border: `1px solid ${C.blue}20`,
                    borderRadius: 12, fontSize: 13, color: C.textSoft, lineHeight: 1.65,
                  }}>
                    <strong style={{ color: C.cyan }}>Bridge years (age {retireAge}–{statePensionAge - 1}):</strong> Before
                    your State Pension starts at {statePensionAge}, your income comes from DC pension drawdown
                    {isaResult.annualDrawdown > 0 ? ` and ISA withdrawals (${formatCurrency(isaResult.annualDrawdown)}/year tax-free)` : ""}.
                    {dcResult.potRunsOut && dcResult.potLastsUntilAge < 90 && (
                      <span style={{ color: C.violet }}> Your DC pot runs out at age {dcResult.potLastsUntilAge}, after which you'd be relying on the State Pension alone ({formatCurrency(spResult.annualAmount)}/year).</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        )}

        </>)}

        {/* ═══════════════════════════════════════════════ */}
        {/* ═══════ TAB 3: ACTION PLAN ═══════════════════ */}
        {/* ═══════════════════════════════════════════════ */}
        {activeTab === "actions" && (<>
        <Divider  />
        <Reveal>
          <SectionLabel text="Action Plan" />
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: "12px 0 8px", letterSpacing: "-0.02em" }}>
            How to Get There
          </h2>
          <p style={{ color: C.textSoft, fontSize: 15, lineHeight: 1.6, marginBottom: 32, marginTop: 0 }}>
            Specific steps based on the gap between where you are and where you want to be.
            These are what the numbers suggest — not financial advice.
          </p>
        </Reveal>

        {/* ─── Gap Summary Card ─── */}
        <Reveal delay={0.1} scale blur>
          <div style={{
            padding: "28px 28px", borderRadius: 16, position: "relative", overflow: "hidden",
            background: C.card,
            border: `1px solid ${C.border}`,
          }}>
            
            

            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{
                fontSize: 11, color: actionPlan.hasGap ? "#f59e0b" : C.green, textTransform: "uppercase",
                letterSpacing: "0.12em", fontFamily: "inherit", marginBottom: 16,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: actionPlan.hasGap ? "#f59e0b" : C.green,
                }} />
                {actionPlan.hasGap ? "Gap to Close" : "On Track"}
              </div>

              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 11, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", marginBottom: 6 }}>
                    Your Target
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "inherit", color: C.text }}>
                    {formatCurrency(actionPlan.targetIncome)}
                  </div>
                  <div style={{ fontSize: 12, color: C.textDim }}>/year net</div>
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 11, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", marginBottom: 6 }}>
                    Projected (at {statePensionAge})
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "inherit", color: C.cyan }}>
                    {formatCurrency(actionPlan.projectedNet)}
                  </div>
                  <div style={{ fontSize: 12, color: C.textDim }}>/year net</div>
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 11, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", marginBottom: 6 }}>
                    {actionPlan.hasGap ? "Annual Gap" : "Surplus"}
                  </div>
                  <div style={{
                    fontSize: 28, fontWeight: 700, fontFamily: "inherit",
                    color: actionPlan.hasGap ? C.red : C.green,
                  }}>
                    {actionPlan.hasGap ? "−" : "+"}{formatCurrency(Math.abs(actionPlan.gap))}
                  </div>
                  <div style={{ fontSize: 12, color: C.textDim }}>/year</div>
                </div>
              </div>

              {/* Bridge years context */}
              {actionPlan.bridgeYears > 0 && (
                <div style={{
                  padding: "12px 16px", background: `${C.violet}08`,
                  border: `1px solid ${C.violet}20`, borderRadius: 8,
                  fontSize: 13, color: C.textSoft, lineHeight: 1.6, marginBottom: 16,
                }}>
                  <strong style={{ color: C.violet }}>Bridge years (age {retireAge}–{statePensionAge - 1}):</strong>{" "}
                  During these {actionPlan.bridgeYears} years before State Pension, your projected net income is{" "}
                  <strong style={{ color: C.text }}>{formatCurrency(actionPlan.bridgeNet)}/year</strong>.
                  {actionPlan.bridgeNet < actionPlan.targetIncome && (
                    <span> That's {formatCurrency(Math.round(actionPlan.targetIncome - actionPlan.bridgeNet))}/year below your target during the bridge period.</span>
                  )}
                </div>
              )}

              <div style={{
                padding: "14px 18px", background: `${actionPlan.hasGap ? "#f59e0b" : C.green}08`,
                border: `1px solid ${actionPlan.hasGap ? "#f59e0b" : C.green}20`,
                borderRadius: 12, fontSize: 14, color: C.textSoft, lineHeight: 1.65,
              }}>
                {actionPlan.hasGap ? (
                  <>
                    <strong style={{ color: C.amber }}>There's a gap to close.</strong>{" "}
                    To reach your target of {formatCurrency(actionPlan.targetIncome)}/year net, you need an additional {formatCurrency(actionPlan.gap)}/year in retirement income.
                    The recommendations below show specific ways to close this gap — ranked by what's generally considered most effective.
                  </>
                ) : (
                  <>
                    <strong style={{ color: C.green }}>You're on track.</strong>{" "}
                    Your projected net income after State Pension age exceeds your target by {formatCurrency(Math.abs(actionPlan.gap))}/year.
                    This gives you a buffer for unexpected costs, or scope to retire earlier or target a higher income.
                  </>
                )}
              </div>
            </div>
          </div>
        </Reveal>

        {/* ─── Recommendations ─── */}
        {actionPlan.recommendations.length > 0 && (
          <Reveal delay={0.2}>
            <div style={{ marginTop: 28 }}>
              <div style={{
                fontSize: 11, color: C.cyan, textTransform: "uppercase",
                letterSpacing: "0.12em", fontFamily: "inherit", marginBottom: 16,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span>Recommendations</span>
                <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${C.pink}30, transparent)` }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {actionPlan.recommendations.map((rec, i) => (
                  <Reveal key={rec.type + i} delay={0.05 * i} direction="right">
                    <div style={{
                      background: C.card, border: `1px solid ${C.border}`,
                      borderRadius: 16, padding: "24px 24px", position: "relative", overflow: "hidden",
                      borderLeft: `3px solid ${rec.color}`,
                    }}>
                      <div style={{ position: "absolute", inset: 0, opacity: 0.3, pointerEvents: "none" }} />

                      <div style={{ position: "relative", zIndex: 1 }}>
                        {/* Header row */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                              <span style={{ fontSize: 20 }}>{rec.icon}</span>
                              <span style={{
                                fontSize: 10, fontFamily: "inherit",
                                color: rec.color, textTransform: "uppercase", letterSpacing: "0.08em",
                                background: `${rec.color}15`, padding: "3px 10px", borderRadius: 4,
                                border: `1px solid ${rec.color}25`,
                              }}>
                                {rec.closesGap ? "Closes gap" : rec.type === "retire_age" ? "Alternative path" : "Partial"}
                              </span>
                            </div>
                            <div style={{ fontSize: 17, fontWeight: 600, color: C.text, lineHeight: 1.3, marginBottom: 4 }}>
                              {rec.title}
                            </div>
                            {rec.subtitle && (
                              <div style={{ fontSize: 13, color: C.textDim, fontFamily: "inherit" }}>
                                {rec.subtitle}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <div style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.65, marginBottom: 16 }}>
                          {rec.description}
                        </div>

                        {/* Impact metrics */}
                        <div style={{
                          display: "flex", gap: 12, flexWrap: "wrap",
                          padding: "14px 16px", background: C.bg, borderRadius: 12,
                          border: `1px solid ${C.border}`,
                        }}>
                          <div style={{ flex: 1, minWidth: 120 }}>
                            <div style={{ fontSize: 10, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                              Impact on Income
                            </div>
                            <div style={{
                              fontSize: 20, fontWeight: 700, fontFamily: "inherit",
                              color: rec.impact > 0 ? C.green : C.red,
                            }}>
                              {rec.impact > 0 ? "+" : ""}{formatCurrency(Math.round(rec.impact))}<span style={{ fontSize: 12, fontWeight: 400, color: C.textDim }}>/yr</span>
                            </div>
                          </div>
                          <div style={{ flex: 1, minWidth: 120 }}>
                            <div style={{ fontSize: 10, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                              New Projected Income
                            </div>
                            <div style={{
                              fontSize: 20, fontWeight: 700, fontFamily: "inherit",
                              color: rec.impactTotal >= actionPlan.targetIncome ? C.green : C.cyan,
                            }}>
                              {formatCurrency(Math.round(rec.impactTotal))}<span style={{ fontSize: 12, fontWeight: 400, color: C.textDim }}>/yr</span>
                            </div>
                          </div>
                          {rec.monthlyCost > 0 && (
                            <div style={{ flex: 1, minWidth: 120 }}>
                              <div style={{ fontSize: 10, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                                Monthly Cost to You
                              </div>
                              <div style={{
                                fontSize: 20, fontWeight: 700, fontFamily: "inherit",
                                color: C.text,
                              }}>
                                {formatCurrency(rec.monthlyCost)}<span style={{ fontSize: 12, fontWeight: 400, color: C.textDim }}>/mo</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Tax relief note for pension recommendations */}
                        {rec.type === "pension_increase" && (
                          <div style={{
                            marginTop: 10, fontSize: 12, color: C.textDim, lineHeight: 1.6,
                            fontStyle: "italic",
                          }}>
                            Monthly cost shown assumes basic rate (20%) tax relief. If contributing via salary sacrifice, you also save National Insurance (currently 8%), making the true cost even lower. Higher-rate taxpayers save 40% — check your payslip or ask your employer.
                          </div>
                        )}
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        {/* ─── Retirement Age Finder ─── */}
        <Reveal delay={0.3}>
          <div style={{
            marginTop: 28, background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 16, padding: "24px 24px", position: "relative", overflow: "hidden",
          }}>
            
            <div style={{ position: "absolute", inset: 0, opacity: 0.3, pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 20 }}>📅</span>
                <div style={{
                  fontSize: 11, color: C.blue, textTransform: "uppercase",
                  letterSpacing: "0.12em", fontFamily: "inherit",
                }}>Retirement Age Analysis</div>
              </div>

              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                {actionPlan.achievableAge
                  ? `Earliest retirement age for your target: ${actionPlan.achievableAge}`
                  : "Your target may require higher contributions or a lower income goal"}
              </div>

              <div style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.65, marginBottom: 16 }}>
                {actionPlan.achievableAge && actionPlan.achievableAge <= retireAge ? (
                  `With your current contributions, you could potentially retire as early as ${actionPlan.achievableAge} and still meet your target of ${formatCurrency(actionPlan.targetIncome)}/year. You've set your target retirement age to ${retireAge}, which gives you ${retireAge - actionPlan.achievableAge} year${retireAge - actionPlan.achievableAge !== 1 ? "s" : ""} of margin.`
                ) : actionPlan.achievableAge ? (
                  `With your current contributions, the earliest you could retire and meet your target of ${formatCurrency(actionPlan.targetIncome)}/year is age ${actionPlan.achievableAge}. That's ${actionPlan.achievableAge - retireAge} year${actionPlan.achievableAge - retireAge !== 1 ? "s" : ""} later than your target of ${retireAge}. Each additional year of work means more contributions going in and fewer years of drawdown.`
                ) : (
                  `Based on current contributions, the tool couldn't find a retirement age between ${Math.ceil(currentAge) + 1} and 75 that meets your target of ${formatCurrency(actionPlan.targetIncome)}/year. This usually means you'd need to increase contributions, lower the target, or both.`
                )}
              </div>

              {/* Age comparison mini-chart: show projected income at different ages */}
              <div style={{
                padding: "16px 16px", background: C.bg, borderRadius: 12,
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 10, color: C.textDim, fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                  Projected net income by retirement age (no other changes)
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(() => {
                    // Generate sequential ages centred around the user's retirement age
                    const center = retireAge;
                    const minAge = Math.max(Math.ceil(currentAge) + 1, 55);
                    const ages = [];
                    for (let a = center - 3; a <= center + 3; a++) {
                      if (a >= minAge && a <= 75) ages.push(a);
                    }
                    // Ensure we always have at least 5 ages shown
                    while (ages.length < 5 && ages[0] > minAge) ages.unshift(ages[0] - 1);
                    while (ages.length < 5 && ages[ages.length - 1] < 75) ages.push(ages[ages.length - 1] + 1);
                    return ages;
                  })().map(testAge => {
                    // Quick projection for this age
                    const testDC = calculateDCPension({
                      currentPotValue: parseFloat(dcPotValue) || 0,
                      monthlyContributionYours: dcContribYoursMonthly,
                      monthlyContributionEmployer: dcContribEmployerMonthly,
                      annualGrowthRate: parseFloat(dcGrowthRate) || 5,
                      inflationRate: parseFloat(inflationRate) || 2,
                      retireAge: testAge,
                      currentAge,
                      lumpSumMode,
                      planToAge: parseInt(planToAge) || 90,
                      statePensionAge,
                      statePensionAnnual: spResult.annualAmount,
                    });
                    const testISA = calculateISA({
                      currentBalance: (parseFloat(cashIsaBalance) || 0) + (parseFloat(ssIsaBalance) || 0),
                      monthlyContribution: (parseFloat(cashIsaMonthlyContrib) || 0) + (parseFloat(ssIsaMonthlyContrib) || 0),
                      annualGrowthRate: blendedIsaGrowthRate,
                      inflationRate: parseFloat(inflationRate) || 2,
                      retireAge: testAge,
                      currentAge,
                      planToAge: parseInt(planToAge) || 90,
                      statePensionAge,
                      statePensionAnnual: spResult.annualAmount,
                    });
                    const taxFree = lumpSumMode === "phased" ? 0.25 : 0;
                    const dcGr = testDC.annualDrawdown;
                    const spGr = spResult.annualAmount;
                    const isaGr = testISA.annualDrawdown;
                    const taxable = dcGr * (1 - taxFree) + spGr;
                    const tx = calculateIncomeTax(taxable);
                    const net = Math.round(dcGr + spGr + isaGr - tx.totalTax);
                    const meetsTarget = net >= (parseFloat(targetIncome) || 25000);
                    const isCurrentChoice = testAge === retireAge;

                    return (
                      <div key={testAge} style={{
                        flex: 1, minWidth: 80, padding: "10px 8px", textAlign: "center",
                        background: isCurrentChoice ? `${C.cyan}10` : "transparent",
                        border: `1px solid ${isCurrentChoice ? C.cyan + "40" : C.border}`,
                        borderRadius: 8,
                      }}>
                        <div style={{
                          fontSize: 18, fontWeight: 700, fontFamily: "inherit",
                          color: isCurrentChoice ? C.cyan : C.text, marginBottom: 4,
                        }}>{testAge}</div>
                        <div style={{
                          fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                          color: meetsTarget ? C.green : C.textSoft,
                        }}>
                          {formatCurrency(net)}
                        </div>
                        <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
                          {isCurrentChoice ? "your choice" : meetsTarget ? "meets target" : "below target"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* ─── Insights & Educational Content ─── */}
        {actionPlan.insights.length > 0 && (
          <Reveal delay={0.35}>
            <div style={{ marginTop: 28 }}>
              <div style={{
                fontSize: 11, color: C.amber, textTransform: "uppercase",
                letterSpacing: "0.12em", fontFamily: "inherit", marginBottom: 16,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span>Insights</span>
                <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, #f59e0b30, transparent)` }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {actionPlan.insights.map((insight, i) => (
                  <div key={insight.type + i} style={{
                    background: `${insight.color}08`, border: `1px solid ${insight.color}20`,
                    borderRadius: 12, padding: "16px 18px",
                    display: "flex", gap: 14, alignItems: "flex-start",
                  }}>
                    <span style={{
                      fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 2,
                      width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                      background: `${insight.color}15`, borderRadius: 6,
                    }}>{insight.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                        {insight.title}
                      </div>
                      <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.65 }}>
                        {insight.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        {/* ─── Educational: Saving Priority Order ─── */}
        <Reveal delay={0.4}>
          <LearnMore title="What order should I prioritise saving in?">
            <p style={{ margin: "0 0 12px" }}>
              While the right approach depends on your individual circumstances, there's a widely accepted priority order that most financial guidance sources agree on:
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>1. Employer pension match</strong> — If your employer matches your contributions (e.g. "we'll put in 5% if you do"), always contribute enough to get the full match. This is effectively a 100% instant return on your money, before any tax relief or investment growth. It's widely considered the single most efficient use of retirement savings.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>2. Pension contributions (for tax relief)</strong> — Beyond the employer match, pension contributions still get at least 20% tax relief from the government (40% if you're a higher-rate taxpayer). Via salary sacrifice, you also save National Insurance. The trade-off is that the money is locked until age 57/58.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>3. ISA contributions</strong> — ISAs don't get tax relief on the way in, but withdrawals are completely tax-free. They're particularly valuable if you plan to retire before 57/58 (you need accessible money for bridge years), or if you want flexibility. The annual ISA allowance is £{TAX_CONFIG.isaAllowance.annualAllowance.toLocaleString()} for {TAX_CONFIG.year}.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>4. General investments</strong> — After tax-advantaged wrappers (pension + ISA) are utilised, general investment accounts can still grow your wealth but are subject to Capital Gains Tax and dividend tax.
            </p>
            <p style={{ margin: "0 0 12px", color: C.textDim, fontSize: 13 }}>
              The pension annual allowance for {TAX_CONFIG.year} is {formatCurrency(TAX_CONFIG.pensionAllowance.annualAllowance)} (total of your contributions + employer contributions + tax relief). Contributions above this trigger a tax charge.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              Sources: MoneyHelper (gov.uk/moneyhelper), GOV.UK pension annual allowance guidance, HSBC retirement planning guidance. This reflects generally accepted practice, not personalised financial advice.
            </p>
          </LearnMore>

          <LearnMore title="Pension vs ISA — which is better for me?">
            <p style={{ margin: "0 0 12px" }}>
              This is one of the most common questions in retirement planning, and the honest answer is: it depends on your circumstances. Here's how to think about it:
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>Pension wins when:</strong> You're a higher-rate taxpayer (40% tax relief is very generous). You don't need the money before 57/58. Your employer matches contributions. You want to maximise tax efficiency.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>ISA wins when:</strong> You might need the money before 57/58. You're planning to retire early and need bridge-year income. You're concerned about future pension rule changes (governments have changed pension rules multiple times). You want complete flexibility.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>The tax maths:</strong> Pensions get tax relief on the way in (20-45%) but are taxed on the way out (as income). ISAs use post-tax money going in but are completely tax-free coming out. For most basic-rate taxpayers, the two end up quite similar — but the employer match and salary sacrifice NI savings tip it in pensions' favour.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.text }}>In practice:</strong> Most financial guidance suggests using both. Get your employer match in pension, then split additional savings between pension (for tax efficiency) and ISA (for flexibility and bridge years).
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
              Sources: Vanguard pension vs ISA comparison, interactive investor, MoneyHelper. For personalised advice, consult a qualified financial adviser.
            </p>
          </LearnMore>

          <LearnMore title="Why does retirement age matter so much?">
            <p style={{ margin: "0 0 12px" }}>
              Changing your retirement age is often the single most powerful lever in retirement planning, because it affects <em>three</em> things simultaneously:
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>1. More years of contributions</strong> — Each extra year of work means 12 more months of pension and ISA contributions going into your pots.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>2. More years of growth</strong> — Your pots have longer to grow through investment returns and compound interest.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: C.cyan }}>3. Fewer years of drawdown</strong> — The same pot needs to last fewer years, so you can withdraw more each year sustainably.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              The combined effect is dramatic. For example, retiring at 62 instead of 60 might increase your sustainable annual income by 15-25%, depending on your circumstances.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: C.textDim }}>
              Of course, working longer isn't always possible or desirable. Health, caring responsibilities, or simply wanting more years of freedom all matter. The numbers are just one input to the decision.
            </p>
          </LearnMore>
        </Reveal>

        {/* ─── Disclaimer ─── */}
        <Reveal delay={0.45}>
          <div style={{
            marginTop: 28, padding: "16px 18px",
            background: C.blueLight, border: `1px solid ${C.blue}15`,
            borderRadius: 12, fontSize: 12, color: C.textDim, lineHeight: 1.7,
          }}>
            <strong style={{ color: C.textSoft }}>Important:</strong> These recommendations are based on mathematical modelling of your inputs and generally accepted financial planning principles. They are not personalised financial advice. Tax rules, pension rules, and investment returns can all change. For advice tailored to your specific circumstances, consult a qualified financial adviser. You can find one through{" "}
            <span style={{ color: C.cyan }}>MoneyHelper</span> (free government service) or{" "}
            <span style={{ color: C.cyan }}>Unbiased.co.uk</span>.
          </div>
        </Reveal>

        </>)}

        {/* ═══════ FOOTER ═══════ */}
        <Divider />
        <div style={{
          paddingBottom: 40, fontSize: 12, color: C.textDim, lineHeight: 1.7, textAlign: "center",
        }}>
          This is a planning tool, not financial advice. Tax calculations use {taxConfig.year} HMRC rates including Personal Allowance tapering.
          Projections are illustrative — consult a qualified financial adviser for personal advice.
          <br />All figures shown in today's money, adjusted for assumed inflation.
          {lastSavedAt && (
            <div style={{ marginTop: 8, fontSize: 11, color: C.textDim, fontFamily: "inherit" }}>
              Last saved: {new Date(lastSavedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 16, opacity: 0.15 }}>
          </div>
        </div>
      </div>
    </div>
  );
}
