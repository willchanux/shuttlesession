
import { Player } from "../types/player";
import { generateValidCombinations } from "./playerCombinations";
import { getRecentGames } from "./gameHistory";
import { computeRepeatPenalty, HistoryGame } from "./repeatPenalty";
import { shuffle } from "./shuffle";
import { determineBestGameType, determineBestGameTypeWithPiggyback, inferPiggybackGameTypePreference } from "./gameValidation";
import { sessionTracker } from "./sessionTracking";

// Game history used for repeat scoring. Loaded once at the start of each
// selection so scoring a candidate group needs no database access.
let recentGames: HistoryGame[] = [];
let sessionStart = 0;

// Performance monitoring
let autoSelectStartTime = 0;
const PERFORMANCE_BUDGET = 2000; // 2 seconds max

/**
 * Validates that no piggyback pairs are split in the given combination
 */
function validatePiggybackIntegrity(
  combination: Player[], 
  piggybackPairs?: Array<{ master: number; partner: number }>
): boolean {
  if (!piggybackPairs || piggybackPairs.length === 0) return true;
  
  const playerIds = new Set(combination.map(p => p.id));
  
  for (const pair of piggybackPairs) {
    const hasMaster = playerIds.has(pair.master);
    const hasPartner = playerIds.has(pair.partner);
    
    // If one player from a pair is selected, the other must also be selected
    if (hasMaster && !hasPartner) {
      console.log(`Piggyback integrity violation: Master ${pair.master} selected without partner ${pair.partner}`);
      return false;
    }
    if (hasPartner && !hasMaster) {
      console.log(`Piggyback integrity violation: Partner ${pair.partner} selected without master ${pair.master}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Enhanced version with weighted selection and session-aware mixing
 * Now supports piggyback pair awareness
 */
export const findBestCombination = async (
  poolPlayers: Player[], 
  piggybackPairs?: Array<{ master: number; partner: number }>
): Promise<Player[]> => {
  if (poolPlayers.length < 4) return [];

  autoSelectStartTime = Date.now();
  console.log("Enhanced Auto-select: Starting with", poolPlayers.length, "players");

  // Load tonight's game history once; scoring then runs entirely in memory
  try {
    recentGames = await getRecentGames();
  } catch (e) {
    console.error("Enhanced Auto-select: Could not load game history, scoring without it", e);
    recentGames = [];
  }
  sessionStart = sessionTracker.getSessionStart();

  // Phase 1: Try smart selection with full pool sampling and piggyback awareness
  const smartSelection = await findSmartCombination(poolPlayers, piggybackPairs);
  if (smartSelection.length === 4) {
    const elapsed = Date.now() - autoSelectStartTime;
    console.log(`Enhanced Auto-select: Found smart combination in ${elapsed}ms`);
    return smartSelection;
  }

  // Phase 2: Smart selection found nothing (or ran out of time). The fallback
  // must always be given the piggyback pairs so it never splits one.
  if (Date.now() - autoSelectStartTime > PERFORMANCE_BUDGET) {
    console.log("Enhanced Auto-select: Using smart fallback due to time limit");
  } else {
    console.log("Enhanced Auto-select: Using smart fallback");
  }
  return findSmartFallbackCombination(poolPlayers, piggybackPairs);
};

/**
 * Checks if a player accepts a specific game type based on their preferences
 */
function playerAcceptsGameType(player: Player, gameType: string): boolean {
  const prefs = player.playPreferences || [];
  if (prefs.length === 0) return true;
  return prefs.includes(gameType as any);
}

/**
 * Smart combination finder using weighted selection and full pool sampling
 * Enhanced with piggyback pair awareness
 */
async function findSmartCombination(
  poolPlayers: Player[], 
  piggybackPairs?: Array<{ master: number; partner: number }>
): Promise<Player[]> {
  // Get weighted starting players (top 3-4 with weighted probability)
  const startingCandidates = getWeightedStartingPlayers(poolPlayers);
  
  let bestCombination: Player[] = [];
  let bestScore = -Infinity;

  // Try each potential starting player
  for (const startingPlayer of startingCandidates) {
    // Generate random combinations from the full pool with piggyback awareness
    const combinations = generateRandomCombinations(poolPlayers, startingPlayer, 40, piggybackPairs);
    
    for (const combination of combinations) {
      // Performance check
      if (Date.now() - autoSelectStartTime > PERFORMANCE_BUDGET * 0.7) {
        console.log("Enhanced Auto-select: 70% time budget reached");
        return bestCombination.length === 4 ? bestCombination : [];
      }

      // Early validation of piggyback integrity
      if (!validatePiggybackIntegrity(combination, piggybackPairs)) {
        console.log("Enhanced Auto-select: Skipping combination due to piggyback violation");
        continue;
      }

      const score = calculateEnhancedScore(combination, poolPlayers, piggybackPairs);
      if (score > bestScore) {
        bestScore = score;
        bestCombination = combination;
        
        // Early exit for excellent combinations with piggyback bonus
        const piggybackBonus = getPiggybackMatchBonus(combination, piggybackPairs);
        if (score > 50 || piggybackBonus > 10) {
          console.log("Enhanced Auto-select: Found excellent combination");
          return bestCombination;
        }
      }
    }
  }

  return bestCombination;
}

/**
 * Get weighted starting players instead of always choosing #1
 */
function getWeightedStartingPlayers(poolPlayers: Player[]): Player[] {
  const candidates = poolPlayers.slice(0, Math.min(4, poolPlayers.length));
  const weights = [0.4, 0.3, 0.2, 0.1]; // 40%, 30%, 20%, 10% probability
  
  // Apply cooling period penalty only (session balance removed for fairness)
  const weightedCandidates = candidates.map((player, index) => {
    const baseWeight = weights[index] || 0.1;
    const coolingPenalty = sessionTracker.isInCoolingPeriod(player.id) ? -0.2 : 0;
    
    return {
      player,
      weight: Math.max(0.05, baseWeight + coolingPenalty)
    };
  });

  // Sort by weight and return top candidates
  return weightedCandidates
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(wc => wc.player);
}

/**
 * Calculate queue position bonus - rewards players waiting longer
 */
function getQueuePositionBonus(combination: Player[], poolPlayers: Player[]): number {
  return combination.reduce((bonus, player) => {
    const position = poolPlayers.findIndex(p => p.id === player.id);
    if (position === 0 || position === 1) return bonus + 10;
    if (position === 2 || position === 3) return bonus + 8;
    if (position === 4 || position === 5) return bonus + 6;
    if (position === 6 || position === 7) return bonus + 3;
    return bonus;
  }, 0);
}

/**
 * Calculate gender balance bonus - prefers 2M+2L mixed games
 */
function getGenderBalanceBonus(combination: Player[]): number {
  const males = combination.filter(p => p.gender === 'male').length;
  const females = combination.filter(p => p.gender === 'female').length;
  
  // Ideal mixed game: 2 males + 2 females
  if (males === 2 && females === 2) return 20;
  
  // Valid ladies game: 4 females
  if (females === 4) return 15;
  
  // Unbalanced but valid (3+1 split)
  return 0;
}

/**
 * Calculate preference satisfaction bonus - rewards combinations where the game type matches player preferences
 */
function getPreferenceSatisfactionBonus(
  combination: Player[],
  piggybackPairs?: Array<{ master: number; partner: number }>
): number {
  const prefEnabled = localStorage.getItem("enablePlayerPreferences") === "true";
  if (!prefEnabled) return 0;

  const gameType = determineBestGameTypeWithPiggyback(combination, piggybackPairs);
  if (!gameType) return -100;

  let bonus = 0;
  for (const player of combination) {
    const prefs = player.playPreferences || [];
    if (prefs.length === 0) continue;

    const prefIndex = prefs.indexOf(gameType as any);
    if (prefIndex === 0) {
      bonus += 10;
    } else if (prefIndex > 0) {
      bonus += 5;
    } else {
      bonus -= 50;
    }
  }
  return bonus;
}

/**
 * Generate random combinations from the entire pool with piggyback awareness
 */
function generateRandomCombinations(
  poolPlayers: Player[], 
  anchorPlayer: Player, 
  count: number,
  piggybackPairs?: Array<{ master: number; partner: number }>
): Player[][] {
  const combinations: Player[][] = [];
  const otherPlayers = poolPlayers.filter(p => p.id !== anchorPlayer.id);
  
  if (otherPlayers.length < 3) return [];

  let attempts = 0;
  const maxAttempts = count * 3; // Safety counter to prevent infinite loops

  for (let i = 0; i < count && combinations.length < count && attempts < maxAttempts; attempts++) {
    let selectedOthers: Player[];
    
    // Check if anchor player is in a piggyback pair
    const anchorPair = piggybackPairs?.find(p => p.master === anchorPlayer.id || p.partner === anchorPlayer.id);
    
    if (anchorPair) {
      // If anchor is piggybacked, must include their partner
      const partnerId = anchorPair.master === anchorPlayer.id ? anchorPair.partner : anchorPair.master;
      const partner = otherPlayers.find(p => p.id === partnerId);
      
      if (partner) {
        const remainingOthers = otherPlayers.filter(p => p.id !== partnerId);
        if (remainingOthers.length >= 2) {
          const shuffled = shuffle(remainingOthers);
          selectedOthers = [partner, ...shuffled.slice(0, 2)];
        } else {
          continue; // Skip if not enough players
        }
      } else {
        continue; // Skip if partner not in pool
      }
    } else {
      // Standard random selection with piggyback validation
      const shuffled = shuffle(otherPlayers);
      selectedOthers = shuffled.slice(0, 3);
    }
    
    const combination = [anchorPlayer, ...selectedOthers];
    
    // Validate piggyback integrity before checking game type
    if (!validatePiggybackIntegrity(combination, piggybackPairs)) {
      console.log("Generate combinations: Rejecting combination due to piggyback violation");
      continue;
    }
    
    // Check if this combination can form a valid game with piggyback awareness
    const gameType = determineBestGameTypeWithPiggyback(combination, piggybackPairs);
    if (gameType) {
      const allAccept = combination.every(player => playerAcceptsGameType(player, gameType));
      if (allAccept) {
        combinations.push(combination);
        i++; // Only increment when we successfully add a combination
      }
    }
  }

  return combinations;
}

/**
 * Calculate enhanced score combining multiple factors including piggyback bonuses
 */
function calculateEnhancedScore(
  combination: Player[],
  poolPlayers: Player[],
  piggybackPairs?: Array<{ master: number; partner: number }>
): number {
  // Early validation - immediately reject if piggyback pairs are split
  if (!validatePiggybackIntegrity(combination, piggybackPairs)) {
    return -Infinity;
  }

  // Base score from repeat penalty (lower is better, so negate). Counts how
  // often this group and each pair in it have played together this session.
  const repeatPenalty = computeRepeatPenalty(combination.map(p => p.id), recentGames, sessionStart);
  const repeatScore = Math.max(0, 50 - repeatPenalty);

  // Queue position bonus - rewards players waiting longer
  const queuePositionBonus = getQueuePositionBonus(combination, poolPlayers);

  // Gender balance bonus - prefers 2M+2L mixed games
  const genderBalanceBonus = getGenderBalanceBonus(combination);

  // Cooling period penalty
  const coolingPenalty = combination.reduce((penalty, player) => {
    return penalty + (sessionTracker.isInCoolingPeriod(player.id) ? 5 : 0);
  }, 0);

  // Variety bonus for new combinations
  const varietyBonus = sessionTracker.getVarietyBonus(combination);
  
  // Piggyback pair satisfaction bonus
  const piggybackBonus = getPiggybackMatchBonus(combination, piggybackPairs);

  // Preference satisfaction bonus
  const preferenceSatisfactionBonus = getPreferenceSatisfactionBonus(combination, piggybackPairs);

  const totalScore = repeatScore + queuePositionBonus + genderBalanceBonus + varietyBonus + piggybackBonus + preferenceSatisfactionBonus - coolingPenalty;
  
  return totalScore;
}

/**
 * Calculates bonus score for piggyback pair satisfaction
 */
function getPiggybackMatchBonus(
  combination: Player[], 
  piggybackPairs?: Array<{ master: number; partner: number }>
): number {
  if (!piggybackPairs || piggybackPairs.length === 0) return 0;
  
  let bonus = 0;
  
  for (const pair of piggybackPairs) {
    const hasMaster = combination.some(p => p.id === pair.master);
    const hasPartner = combination.some(p => p.id === pair.partner);
    
    // Big bonus for including a complete piggyback pair
    if (hasMaster && hasPartner) {
      bonus += 15;
      
      // Extra bonus if the game type matches their implied preference
      const masterPlayer = combination.find(p => p.id === pair.master);
      const partnerPlayer = combination.find(p => p.id === pair.partner);
      
      if (masterPlayer && partnerPlayer) {
        const gameType = determineBestGameTypeWithPiggyback(combination, piggybackPairs);
        const impliedPreference = inferPiggybackGameTypePreference(masterPlayer, partnerPlayer);
        
        if (gameType === impliedPreference) {
          bonus += 10; // Extra bonus for matching implied game type
        }
      }
    }
  }
  
  return bonus;
}

/**
 * Smart fallback that considers session balance and piggyback pairs
 */
function findSmartFallbackCombination(
  poolPlayers: Player[], 
  piggybackPairs?: Array<{ master: number; partner: number }>
): Player[] {
  // Sort players by session balance (players who need more games first)
  const sortedByBalance = [...poolPlayers].sort((a, b) => {
    const balanceA = sessionTracker.getSessionBalanceScore(a.id);
    const balanceB = sessionTracker.getSessionBalanceScore(b.id);
    
    // If balance is equal, prefer players not in cooling period
    if (Math.abs(balanceA - balanceB) < 0.1) {
      const coolingA = sessionTracker.isInCoolingPeriod(a.id) ? 1 : 0;
      const coolingB = sessionTracker.isInCoolingPeriod(b.id) ? 1 : 0;
      return coolingA - coolingB;
    }
    
    return balanceB - balanceA;
  });
  
  // Prioritize combinations with piggyback pairs
  if (piggybackPairs && piggybackPairs.length > 0) {
    for (const pair of piggybackPairs) {
      const masterPlayer = poolPlayers.find(p => p.id === pair.master);
      const partnerPlayer = poolPlayers.find(p => p.id === pair.partner);
      
      if (masterPlayer && partnerPlayer) {
        // Try to build a combination around this piggyback pair
        const otherPlayers = poolPlayers.filter(p => p.id !== pair.master && p.id !== pair.partner);
        
        for (let i = 0; i < otherPlayers.length - 1; i++) {
          for (let j = i + 1; j < otherPlayers.length; j++) {
            const combination = [masterPlayer, partnerPlayer, otherPlayers[i], otherPlayers[j]];

            // The extra two players may belong to other pairs; never split one
            if (!validatePiggybackIntegrity(combination, piggybackPairs)) continue;

            const gameType = determineBestGameTypeWithPiggyback(combination, piggybackPairs);
            
            if (gameType) {
              const allAccept = combination.every(player => playerAcceptsGameType(player, gameType));
              if (allAccept) {
                console.log("Enhanced Auto-select: Piggyback-prioritized fallback successful");
                return combination;
              }
            }
          }
        }
      }
    }
  }

  // Try combinations starting with the most balanced players with piggyback validation
  for (let i = 0; i <= Math.max(0, sortedByBalance.length - 4); i++) {
    const combination = sortedByBalance.slice(i, i + 4);
    
    if (combination.length === 4) {
      // Validate piggyback integrity before checking game type
      if (!validatePiggybackIntegrity(combination, piggybackPairs)) {
        console.log("Smart fallback: Skipping combination due to piggyback violation");
        continue;
      }
      
      const gameType = determineBestGameTypeWithPiggyback(combination, piggybackPairs);
      if (gameType) {
        const allAccept = combination.every(player => playerAcceptsGameType(player, gameType));
        if (allAccept) {
          console.log("Enhanced Auto-select: Smart fallback successful");
          return combination;
        }
      }
    }
  }
  
  // Ultimate fallback - piggyback-aware selection
  return findPiggybackAwareFallback(poolPlayers, piggybackPairs);
}

/**
 * Ultimate fallback that tries to respect piggyback pairs even in last resort
 */
function findPiggybackAwareFallback(
  poolPlayers: Player[], 
  piggybackPairs?: Array<{ master: number; partner: number }>
): Player[] {
  // Try different starting positions to find a valid combination
  for (let start = 0; start <= Math.max(0, poolPlayers.length - 4); start++) {
    const combination = poolPlayers.slice(start, start + 4);
    
    if (combination.length === 4) {
      // Check piggyback integrity
      if (validatePiggybackIntegrity(combination, piggybackPairs)) {
        const gameType = determineBestGameTypeWithPiggyback(combination, piggybackPairs);
        if (gameType) {
          // CRITICAL: Validate that all players accept the determined game type
          const allAccept = combination.every(player => playerAcceptsGameType(player, gameType));
          if (allAccept) {
            console.log("Enhanced Auto-select: Piggyback-aware ultimate fallback used");
            return combination;
          } else {
            console.log(`Ultimate fallback: Rejecting combination - not all players accept ${gameType} game type`);
          }
        }
      } else {
        console.log("Ultimate fallback: Skipping combination due to piggyback violation");
      }
    }
  }
  
  // If all else fails, return empty array rather than split piggyback pairs
  console.log("Enhanced Auto-select: No valid combination found that respects piggyback pairs");
  return [];
}
