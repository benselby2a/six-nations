// Scoring rules and points calculation
// Classic script (shared global scope); load order is set in index.html.

        function normalizeScoringRules(sourceRules = null) {
            const fallback = {
                correctResultPoints: 3,
                perfectScoreBonus: 3,
                drawBonus: 2,
                applyClosePerTeam: true,
                maxJokersPerUser: 1,
                entryFeeAmount: 0,
                payoutFirstPct: 0,
                payoutSecondPct: 0,
                payoutThirdPct: 0,
                payoutClosestTriesPct: 0,
                closeTiers: [{ tierOrder: 1, withinPoints: 5, bonusPoints: 1 }]
            };

            const source = sourceRules || fallback;
            const closeTiers = ((source.closeTiers || fallback.closeTiers) || [])
                .map((tier, index) => ({
                    tierOrder: Math.max(1, Number(tier.tierOrder ?? index + 1) || index + 1),
                    withinPoints: Math.max(0, Number(tier.withinPoints ?? 0) || 0),
                    bonusPoints: Math.max(0, Number(tier.bonusPoints ?? 0) || 0)
                }))
                .sort((a, b) => a.withinPoints - b.withinPoints)
                .slice(0, 3);

            return {
                correctResultPoints: Math.max(0, Number(source.correctResultPoints ?? fallback.correctResultPoints) || 0),
                perfectScoreBonus: Math.max(0, Number(source.perfectScoreBonus ?? fallback.perfectScoreBonus) || 0),
                drawBonus: Math.max(0, Number(source.drawBonus ?? fallback.drawBonus) || 0),
                applyClosePerTeam: true,
                maxJokersPerUser: Math.max(0, Number(source.maxJokersPerUser ?? fallback.maxJokersPerUser) || 0),
                entryFeeAmount: Math.max(0, Number(source.entryFeeAmount ?? fallback.entryFeeAmount) || 0),
                payoutFirstPct: Math.max(0, Number(source.payoutFirstPct ?? fallback.payoutFirstPct) || 0),
                payoutSecondPct: Math.max(0, Number(source.payoutSecondPct ?? fallback.payoutSecondPct) || 0),
                payoutThirdPct: Math.max(0, Number(source.payoutThirdPct ?? fallback.payoutThirdPct) || 0),
                payoutClosestTriesPct: Math.max(0, Number(source.payoutClosestTriesPct ?? fallback.payoutClosestTriesPct) || 0),
                closeTiers: closeTiers.length > 0 ? closeTiers : fallback.closeTiers
            };
        }

        function getEffectiveScoringRules() {
            return normalizeScoringRules(activeScoringRules);
        }

        function getUserSelectedJokerMatchIds(username) {
            const fromNewTable = userJokerSelections && Array.isArray(userJokerSelections[username])
                ? userJokerSelections[username]
                : [];
            if (fromNewTable.length > 0) {
                const eligibleIds = new Set(getEligibleJokerMatchIds());
                return [...new Set(fromNewTable.map(id => Number(id)).filter(Number.isInteger))]
                    .filter(id => eligibleIds.has(id))
                    .sort((a, b) => a - b);
            }

            return [];
        }

        function getStoredUserJokerMatchIds(username) {
            const normalizedUsername = (username || '').trim().toLowerCase();
            if (!normalizedUsername) return [];
            const storedSelections = userJokerSelections && Array.isArray(userJokerSelections[normalizedUsername])
                ? userJokerSelections[normalizedUsername]
                : [];

            return [...new Set(storedSelections.map(id => Number(id)).filter(Number.isInteger))]
                .sort((a, b) => a - b);
        }

        function setUserSelectedJokerMatchIds(username, matchIds) {
            const normalizedUsername = (username || '').trim().toLowerCase();
            if (!normalizedUsername) return;
            const eligibleIds = new Set(getEligibleJokerMatchIds());
            const requiredJokers = getRequiredJokerCount();
            const normalized = [...new Set((matchIds || [])
                .map(id => Number(id))
                .filter(Number.isInteger))]
                .filter(id => eligibleIds.has(id))
                .sort((a, b) => a - b)
                .slice(0, requiredJokers === 0 ? 0 : requiredJokers);

            userJokerSelections[normalizedUsername] = normalized;
        }

        function isUserJokerForMatch(username, matchId) {
            const parsedMatchId = Number(matchId);
            if (!Number.isInteger(parsedMatchId)) return false;
            return getUserSelectedJokerMatchIds(username).includes(parsedMatchId);
        }

        function findCloseTierForDiff(diff, rules) {
            if (!Number.isFinite(diff) || diff < 0) return null;
            const eligible = (rules.closeTiers || []).filter(tier => diff <= tier.withinPoints);
            if (eligible.length === 0) return null;

            return eligible.reduce((best, tier) => {
                if (!best) return tier;
                if (tier.bonusPoints > best.bonusPoints) return tier;
                if (tier.bonusPoints === best.bonusPoints && tier.withinPoints < best.withinPoints) return tier;
                return best;
            }, null);
        }

        // Shared scoring logic used across leaderboard, summary, and PDF export.
        function calculateMatchPoints(prediction, match, isJoker = false) {
            if (!prediction || match.actualScore1 === null || match.actualScore2 === null) {
                return null;
            }
            return getMatchPointsBreakdown(prediction, match, isJoker).points;
        }

        function calculateMatchPointsBreakdownWithRules(prediction, match, isJoker, rules) {
            if (!prediction || match.actualScore1 === null || match.actualScore2 === null) {
                return {
                    points: 0,
                    summary: '',
                    basePoints: 0,
                    correctResult: false,
                    perfectScore: false,
                    team1CloseBonus: 0,
                    team2CloseBonus: 0,
                    drawBonus: 0,
                    jokerApplied: false
                };
            }

            const actualResult = getResult(match.actualScore1, match.actualScore2);
            const predictedResult = getResult(prediction.team1, prediction.team2);
            const correctResult = actualResult === predictedResult;
            const parts = [];
            let basePoints = 0;
            let perfectScore = false;
            let team1CloseBonus = 0;
            let team2CloseBonus = 0;
            let drawBonus = 0;

            if (correctResult) {
                if (rules.correctResultPoints > 0) {
                    basePoints += rules.correctResultPoints;
                    parts.push(`Correct Result (+${rules.correctResultPoints})`);
                }

                const team1Diff = Math.abs(prediction.team1 - match.actualScore1);
                const team2Diff = Math.abs(prediction.team2 - match.actualScore2);
                perfectScore = team1Diff === 0 && team2Diff === 0;

                if (perfectScore) {
                    if (rules.perfectScoreBonus > 0) {
                        basePoints += rules.perfectScoreBonus;
                        parts.push(`Perfect Score (+${rules.perfectScoreBonus})`);
                    }
                } else {
                    const team1Tier = findCloseTierForDiff(team1Diff, rules);
                    if (team1Tier && team1Tier.bonusPoints > 0) {
                        team1CloseBonus = team1Tier.bonusPoints;
                        basePoints += team1CloseBonus;
                        parts.push(`${match.team1} Close Score (+${team1CloseBonus})`);
                    }

                    const team2Tier = findCloseTierForDiff(team2Diff, rules);
                    if (team2Tier && team2Tier.bonusPoints > 0) {
                        team2CloseBonus = team2Tier.bonusPoints;
                        basePoints += team2CloseBonus;
                        parts.push(`${match.team2} Close Score (+${team2CloseBonus})`);
                    }
                }

                if (actualResult === 'draw' && rules.drawBonus > 0) {
                    drawBonus = rules.drawBonus;
                    basePoints += drawBonus;
                    parts.push(`Draw Bonus (+${drawBonus})`);
                }
            }

            let points = basePoints;
            const jokerApplied = !!isJoker && basePoints > 0;
            if (jokerApplied) {
                points *= 2;
                parts.push(`Joker Bonus (x2: ${basePoints} to ${points})`);
            }

            return {
                points,
                summary: points === 0 ? '' : parts.join(' + '),
                basePoints,
                correctResult,
                perfectScore,
                team1CloseBonus,
                team2CloseBonus,
                drawBonus,
                jokerApplied
            };
        }

        // Return both points and a short explanation for completed matches.
        function getMatchPointsBreakdown(prediction, match, isJoker = false) {
            const rules = getEffectiveScoringRules();
            return calculateMatchPointsBreakdownWithRules(prediction, match, isJoker, rules);
        }

        // Calculate points based on scoring rules
        function calculatePoints(username) {
            const user = users[username];
            if (!user) return 0;
            let totalPoints = 0;

            matches.forEach(match => {
                const prediction = user.predictions[match.id];
                const matchPoints = calculateMatchPoints(prediction, match, isUserJokerForMatch(username, match.id));
                if (matchPoints !== null) totalPoints += matchPoints;
            });

            return totalPoints;
        }

        // Helper function to determine result (win/draw)
        function getResult(score1, score2) {
            if (score1 > score2) return 'team1';
            if (score2 > score1) return 'team2';
            return 'draw';
        }

        function formatStatNameList(usernames) {
            const names = (usernames || []).map(username => getStattoDisplayName(username));
            if (names.length === 0) return '';
            if (names.length === 1) return names[0];
            if (names.length === 2) return `${names[0]} and ${names[1]}`;
            if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
            return `${names.slice(0, 3).join(', ')} and ${names.length - 3} others`;
        }

        function formatActualScoreline(match) {
            return `${match.team1} ${match.actualScore1}-${match.actualScore2} ${match.team2}`;
        }

        function formatPredictedOutcomeSnippet(username, match, predictedResult, prediction) {
            if (predictedResult === 'team1') {
                return `opting for ${match.team1} over ${match.team2} with a ${prediction.team1}-${prediction.team2} card`;
            }
            if (predictedResult === 'team2') {
                return `opting for ${match.team2} over ${match.team1} with a ${prediction.team1}-${prediction.team2} card`;
            }
            return `calling a ${prediction.team1}-${prediction.team2} draw in ${match.team1} vs ${match.team2}`;
        }

        function isMatchComplete(match) {
            return match.actualScore1 !== null && match.actualScore2 !== null;
        }

        function isFinalRoundRunInActive() {
            if (!matches || matches.length === 0) return false;
            const rounds = [...new Set(matches.map(match => Number(match.round) || 0))]
                .filter(round => round > 0)
                .sort((a, b) => a - b);
            if (rounds.length === 0) return false;

            const finalRound = rounds[rounds.length - 1];
            const finalRoundMatches = matches.filter(match => match.round === finalRound);
            if (finalRoundMatches.length === 0) return false;
            if (!finalRoundMatches.some(match => !isMatchComplete(match))) return false;

            const earlierRounds = matches.filter(match => (Number(match.round) || 0) < finalRound);
            return earlierRounds.every(isMatchComplete);
        }

        function getRemainingFinalRoundMatches() {
            if (!isFinalRoundRunInActive()) return [];
            const finalRound = Math.max(...matches.map(match => Number(match.round) || 0));
            return matches.filter(match => match.round === finalRound && !isMatchComplete(match));
        }

        function isTournamentComplete() {
            return matches.length > 0 && matches.every(isMatchComplete);
        }
