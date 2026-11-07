// Trev's Tips and Statto text generators
// Classic script (shared global scope); load order is set in index.html.

        function getScenarioCandidateScores(match, allUsers) {
            const fallbackByResult = {
                team1: { team1: 24, team2: 17 },
                team2: { team1: 17, team2: 24 },
                draw: { team1: 20, team2: 20 }
            };
            const seen = new Set();
            const candidates = [];
            const predictionCounts = new Map();

            allUsers.forEach(username => {
                const prediction = users[username] && users[username].predictions
                    ? users[username].predictions[match.id]
                    : null;
                if (!prediction || !Number.isFinite(prediction.team1) || !Number.isFinite(prediction.team2)) return;
                const key = `${prediction.team1}-${prediction.team2}`;
                predictionCounts.set(key, (predictionCounts.get(key) || 0) + 1);
            });

            [...predictionCounts.entries()]
                .sort((a, b) => {
                    if (b[1] !== a[1]) return b[1] - a[1];
                    return a[0].localeCompare(b[0]);
                })
                .slice(0, 6)
                .forEach(([key]) => {
                    if (seen.has(key)) return;
                    const [team1, team2] = key.split('-').map(Number);
                    candidates.push({ team1, team2, result: getResult(team1, team2) });
                    seen.add(key);
                });

            ['team1', 'team2', 'draw'].forEach(result => {
                const existing = candidates.some(candidate => candidate.result === result);
                if (existing) return;
                const fallback = fallbackByResult[result];
                const key = `${fallback.team1}-${fallback.team2}`;
                if (seen.has(key)) return;
                candidates.push({ ...fallback, result });
                seen.add(key);
            });

            return candidates.slice(0, 8);
        }

        function buildScenarioResultText(match, result) {
            if (result === 'team1') return `${match.team1} win`;
            if (result === 'team2') return `${match.team2} win`;
            return `${match.team1} and ${match.team2} draw`;
        }

        function joinNaturalLanguageList(parts) {
            if (!parts || parts.length === 0) return '';
            if (parts.length === 1) return parts[0];
            if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
            return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
        }

        function buildTrevsRunInSection(leaderboardData, allUsers, formatDisplayName = getTrevsTipsDisplayName) {
            const remainingMatches = getRemainingFinalRoundMatches();
            if (remainingMatches.length === 0 || leaderboardData.length < 2) return '';

            const rules = getEffectiveScoringRules();
            const currentActualTries = getTotalActualTries();
            const projectedTournamentTries = getProjectedTournamentTriesTotal();
            const sortedLeaderboard = leaderboardData.map(entry => ({
                username: entry.username,
                points: entry.points,
                nickname: formatDisplayName(entry.username)
            }));
            const topThree = sortedLeaderboard.slice(0, 3);
            const bottomThree = sortedLeaderboard.slice(-3);
            const topThreeSet = new Set(topThree.map(entry => entry.username));
            const bottomThreeSet = new Set(bottomThree.map(entry => entry.username));
            const basePointsByUser = {};
            allUsers.forEach(username => {
                basePointsByUser[username] = 0;
                matches.forEach(match => {
                    if (!isMatchComplete(match)) return;
                    const prediction = users[username] && users[username].predictions
                        ? users[username].predictions[match.id]
                        : null;
                    const matchPoints = calculateMatchPoints(prediction, match, isUserJokerForMatch(username, match.id));
                    if (matchPoints !== null) basePointsByUser[username] += matchPoints;
                });
            });

            const candidateSets = remainingMatches.map(match => getScenarioCandidateScores(match, allUsers));
            if (candidateSets.some(set => set.length === 0)) return '';

            const totalScenarioCount = candidateSets.reduce((total, set) => total * set.length, 1);
            if (totalScenarioCount <= 0 || totalScenarioCount > 5000) return '';
            const maxScoreSwingPerMatch = rules.correctResultPoints + rules.perfectScoreBonus + rules.drawBonus + 2 * Math.max(0, ...((rules.closeTiers || []).map(tier => Number(tier.bonusPoints) || 0)));

            const remainingJokerUsers = allUsers
                .map(username => ({
                    username,
                    nickname: formatDisplayName(username),
                    jokerMatches: remainingMatches.filter(match => isUserJokerForMatch(username, match.id))
                }))
                .filter(entry => entry.jokerMatches.length > 0);

            const scenarioSummaries = [];
            const titleWinnersByResult = remainingMatches.map(() => ({
                team1: new Set(),
                team2: new Set(),
                draw: new Set()
            }));
            const bottomByResult = remainingMatches.map(() => ({
                team1: new Set(),
                team2: new Set(),
                draw: new Set()
            }));
            const topThreeWinCounts = new Map(topThree.map(entry => [entry.username, 0]));
            const bottomThreeBottomCounts = new Map(bottomThree.map(entry => [entry.username, 0]));

            const walkScenarios = (index, selectedScores) => {
                if (index === remainingMatches.length) {
                    const totals = allUsers.map(username => {
                        let points = basePointsByUser[username];
                        remainingMatches.forEach((match, matchIndex) => {
                            const scenarioScore = selectedScores[matchIndex];
                            const simulatedMatch = {
                                ...match,
                                actualScore1: scenarioScore.team1,
                                actualScore2: scenarioScore.team2
                            };
                            const prediction = users[username] && users[username].predictions
                                ? users[username].predictions[match.id]
                                : null;
                            const breakdown = calculateMatchPointsBreakdownWithRules(
                                prediction,
                                simulatedMatch,
                                isUserJokerForMatch(username, match.id),
                                rules
                            );
                            points += breakdown.points;
                        });
                        return { username, points };
                    });

                    const topPoints = Math.max(...totals.map(entry => entry.points));
                    const winners = totals.filter(entry => entry.points === topPoints);
                    const bottomPoints = Math.min(...totals.map(entry => entry.points));
                    const bottomUsers = totals.filter(entry => entry.points === bottomPoints);
                    scenarioSummaries.push({
                        selectedScores: selectedScores.map(score => ({ ...score })),
                        winners: winners.map(entry => entry.username),
                        bottomUsers: bottomUsers.map(entry => entry.username)
                    });

                    winners.forEach(entry => {
                        if (topThreeWinCounts.has(entry.username)) {
                            topThreeWinCounts.set(entry.username, topThreeWinCounts.get(entry.username) + 1);
                        }
                    });
                    bottomUsers.forEach(entry => {
                        if (bottomThreeBottomCounts.has(entry.username)) {
                            bottomThreeBottomCounts.set(entry.username, bottomThreeBottomCounts.get(entry.username) + 1);
                        }
                    });

                    selectedScores.forEach((score, matchIndex) => {
                        winners.forEach(username => {
                            if (topThreeSet.has(username)) {
                                titleWinnersByResult[matchIndex][score.result].add(username);
                            }
                        });
                        bottomUsers.forEach(username => {
                            if (bottomThreeSet.has(username)) {
                                bottomByResult[matchIndex][score.result].add(username);
                            }
                        });
                    });
                    return;
                }

                candidateSets[index].forEach(candidate => {
                    selectedScores.push(candidate);
                    walkScenarios(index + 1, selectedScores);
                    selectedScores.pop();
                });
            };

            walkScenarios(0, []);

            const titleLive = topThree.filter(entry => (topThreeWinCounts.get(entry.username) || 0) > 0);
            const titleIntroCore = titleLive.length === 0
                ? `the press-room sums say ${topThree[0].nickname} has already got one hand on the trophy`
                : titleLive.length === 1
                    ? `it has narrowed to ${titleLive[0].nickname}, who is carrying the clearest title route into the closing games`
                    : `it is really a ${titleLive.length}-way scrap between ${joinNaturalLanguageList(titleLive.map(entry => entry.nickname))}`;
            const titleIntro = `As we lead up to the final weekend, ${titleIntroCore}.`;

            const summarizeResultFavour = (bucketSet, sourceEntries) => {
                const names = sourceEntries
                    .filter(entry => bucketSet.has(entry.username))
                    .map(entry => entry.nickname);
                return names.length > 0 ? joinNaturalLanguageList(names) : '';
            };

            const titleLines = remainingMatches.map((match, matchIndex) => {
                const buckets = titleWinnersByResult[matchIndex];
                const labels = [
                    { result: 'team1', label: `${match.team1} win`, names: summarizeResultFavour(buckets.team1, topThree) },
                    { result: 'team2', label: `${match.team2} win`, names: summarizeResultFavour(buckets.team2, topThree) },
                    { result: 'draw', label: 'draw', names: summarizeResultFavour(buckets.draw, topThree) }
                ].filter(entry => entry.names);
                if (labels.length === 0) return '';
                const distinctNameSets = [...new Set(labels.map(entry => entry.names))];
                if (distinctNameSets.length === 1) {
                    return `For the title picture, ${match.team1} v ${match.team2} mostly comes down to scoring texture rather than result alone, because every broad outcome still leans toward ${distinctNameSets[0]}.`;
                }
                return `For the title picture, a ${labels.map(entry => `${entry.label} favours ${entry.names}`).join(', while ')}.`;
            }).filter(Boolean);

            const bottomLines = remainingMatches.map((match, matchIndex) => {
                const buckets = bottomByResult[matchIndex];
                const labels = [
                    { result: 'team1', label: `${match.team1} win`, names: summarizeResultFavour(buckets.team1, bottomThree) },
                    { result: 'team2', label: `${match.team2} win`, names: summarizeResultFavour(buckets.team2, bottomThree) },
                    { result: 'draw', label: 'draw', names: summarizeResultFavour(buckets.draw, bottomThree) }
                ].filter(entry => entry.names);
                if (labels.length === 0) return '';
                const distinctNameSets = [...new Set(labels.map(entry => entry.names))];
                if (distinctNameSets.length === 1) {
                    return `At the wrong end, ${match.team1} v ${match.team2} still leaves ${distinctNameSets[0]} looking over the shoulder whatever the broad result line says.`;
                }
                return `At the wrong end, a ${labels.map(entry => `${entry.label} hurts ${entry.names}`).join(', while ')}.`;
            }).filter(Boolean);

            const fixtureSwingSummaries = remainingMatches.map((match, matchIndex) => {
                const titleBucketNames = [
                    summarizeResultFavour(titleWinnersByResult[matchIndex].team1, topThree),
                    summarizeResultFavour(titleWinnersByResult[matchIndex].team2, topThree),
                    summarizeResultFavour(titleWinnersByResult[matchIndex].draw, topThree)
                ].filter(Boolean);
                const bottomBucketNames = [
                    summarizeResultFavour(bottomByResult[matchIndex].team1, bottomThree),
                    summarizeResultFavour(bottomByResult[matchIndex].team2, bottomThree),
                    summarizeResultFavour(bottomByResult[matchIndex].draw, bottomThree)
                ].filter(Boolean);
                const titleSpread = new Set(titleBucketNames).size;
                const bottomSpread = new Set(bottomBucketNames).size;
                return {
                    match,
                    spread: titleSpread + bottomSpread
                };
            }).sort((a, b) => b.spread - a.spread);

            const wideOpenLine = fixtureSwingSummaries.length >= 2 && fixtureSwingSummaries[0].spread >= 3
                ? `The fixtures most likely to throw this thing wide open look to be ${fixtureSwingSummaries[0].match.team1} v ${fixtureSwingSummaries[0].match.team2}${fixtureSwingSummaries[1] && fixtureSwingSummaries[1].spread >= 3 ? ` and ${fixtureSwingSummaries[1].match.team1} v ${fixtureSwingSummaries[1].match.team2}` : ''}.`
                : '';

            const contrarianCalls = [];
            remainingMatches.forEach(match => {
                const picks = allUsers.map(username => {
                    const prediction = users[username] && users[username].predictions
                        ? users[username].predictions[match.id]
                        : null;
                    if (!prediction || !Number.isFinite(prediction.team1) || !Number.isFinite(prediction.team2)) return null;
                    return {
                        username,
                        nickname: formatDisplayName(username),
                        result: getResult(prediction.team1, prediction.team2),
                        isJoker: isUserJokerForMatch(username, match.id)
                    };
                }).filter(Boolean);

                const resultGroups = {
                    team1: picks.filter(pick => pick.result === 'team1'),
                    team2: picks.filter(pick => pick.result === 'team2'),
                    draw: picks.filter(pick => pick.result === 'draw')
                };

                ['team1', 'team2', 'draw'].forEach(result => {
                    const group = resultGroups[result];
                    if (group.length === 0 || group.length > 2) return;
                    const jokerBackers = group.filter(entry => entry.isJoker);
                    const usernames = group.map(entry => entry.username);
                    contrarianCalls.push({
                        match,
                        label: buildScenarioResultText(match, result),
                        names: joinNaturalLanguageList(group.map(entry => entry.nickname)),
                        jokerNames: joinNaturalLanguageList(jokerBackers.map(entry => entry.nickname)),
                        weight: jokerBackers.length * 3
                            + group.filter(entry => topThreeSet.has(entry.username)).length * 2
                            + group.filter(entry => bottomThreeSet.has(entry.username)).length
                            - group.length
                    });
                });
            });

            contrarianCalls.sort((a, b) => b.weight - a.weight);
            const jokerLine = remainingJokerUsers.length > 0
                ? (() => {
                    const jokerByMatch = remainingMatches.map(match => ({
                        match,
                        users: remainingJokerUsers.filter(entry => entry.jokerMatches.some(jokerMatch => jokerMatch.id === match.id))
                    }));
                    const loneJokerMatch = jokerByMatch.find(entry => entry.users.length === 1);
                    const crowdJokerMatch = jokerByMatch
                        .slice()
                        .sort((a, b) => b.users.length - a.users.length)[0];

                    if (loneJokerMatch && crowdJokerMatch && crowdJokerMatch.users.length > loneJokerMatch.users.length) {
                        return `The joker subplot is split two ways: only ${loneJokerMatch.users[0].nickname} has gone for ${loneJokerMatch.match.team1} v ${loneJokerMatch.match.team2}, while ${crowdJokerMatch.users.length === allUsers.length - 1 ? 'everyone else has piled into' : `${joinNaturalLanguageList(crowdJokerMatch.users.slice(0, 4).map(entry => entry.nickname))} are clustered on`} ${crowdJokerMatch.match.team1} v ${crowdJokerMatch.match.team2}.`;
                    }

                    const highlighted = remainingJokerUsers
                        .slice(0, 3)
                        .map(entry => `${entry.nickname} on ${joinNaturalLanguageList(entry.jokerMatches.map(match => `${match.team1} v ${match.team2}`))}`);
                    return `There is joker ink all over this final edition too, with ${joinNaturalLanguageList(highlighted)} still carrying double-points dynamite.`;
                })()
                : '';
            const swingLine = remainingMatches.length > 0
                ? `With up to ${remainingMatches.length * maxScoreSwingPerMatch} points still available from here, one nerveless exact score or one ugly low-scoring arm wrestle can still shove the whole leaderboard sideways.`
                : '';
            const triesLine = projectedTournamentTries !== null
                ? (() => {
                    const candidatePointTotals = candidateSets.reduce((list, set) => {
                        set.forEach(score => list.push(score.team1 + score.team2));
                        return list;
                    }, []);
                    const avgCandidatePoints = candidatePointTotals.length > 0
                        ? candidatePointTotals.reduce((sum, total) => sum + total, 0) / candidatePointTotals.length
                        : 0;
                    const finishingStyle = avgCandidatePoints >= 48
                        ? 'The remaining scorecards are leaning lively as well'
                        : avgCandidatePoints <= 38
                            ? 'The remaining scorecards look a bit more arm-wrestle than exhibition'
                            : 'The remaining scorecards are split between open rugby and trench warfare';
                    return `The tries ticker is on ${currentActualTries} so far and still projects to finish around ${projectedTournamentTries}. ${finishingStyle}, so the total-tries race has not gone quiet either.`;
                })()
                : '';
            const contrarianLine = contrarianCalls.length > 0
                ? (() => {
                    const standoutCalls = contrarianCalls.slice(0, 3).map(call => {
                        const jokerSuffix = call.jokerNames
                            ? `, with ${call.jokerNames} doubling down on it`
                            : '';
                        return `${call.label} in ${call.match.team1} v ${call.match.team2}, carried by ${call.names}${jokerSuffix}`;
                    });
                    return `The proper contrarian shouts are ${joinNaturalLanguageList(standoutCalls)}; if any of those land, the table could lurch in a hurry.`;
                })()
                : '';

            return `${titleIntro} ${wideOpenLine} ${titleLines.join(' ')} ${bottomLines.join(' ')} ${contrarianLine} ${jokerLine} ${swingLine} ${triesLine}`.replace(/\s+/g, ' ').trim();
        }

        function buildTrevsCompletedTournamentSection(leaderboardData) {
            if (!isTournamentComplete() || leaderboardData.length === 0) return '';

            const topThree = leaderboardData.slice(0, 3);
            const lastPlace = leaderboardData[leaderboardData.length - 1];
            const leader = topThree[0];
            const second = topThree[1] || null;
            const third = topThree[2] || null;
            const winningGroup = leaderboardData.filter(entry => entry.points === leader.points);
            const losingGroup = leaderboardData.filter(entry => entry.points === lastPlace.points);
            const actualTries = getTotalActualTries();
            const triesLeaders = leaderboardData
                .map(entry => {
                    const predicted = users[entry.username] ? users[entry.username].totalTries : null;
                    return {
                        username: entry.username,
                        nickname: entry.nickname,
                        predicted: Number.isFinite(Number(predicted)) ? Number(predicted) : null,
                        diff: Number.isFinite(Number(predicted)) ? Math.abs(Number(predicted) - actualTries) : null
                    };
                })
                .filter(entry => entry.predicted !== null)
                .sort((a, b) => {
                    if (a.diff !== b.diff) return a.diff - b.diff;
                    return a.nickname.localeCompare(b.nickname);
                });
            const bestTryDiff = triesLeaders.length > 0 ? triesLeaders[0].diff : null;
            const tryWinners = bestTryDiff === null
                ? []
                : triesLeaders.filter(entry => entry.diff === bestTryDiff);
            const formatNicknameGroup = (entries) => joinNaturalLanguageList(entries.map(entry => entry.nickname));
            const classicGloucesterRefs = [
                'with the sort of certainty Kingsholm used to reserve for the Cherry and Whites on a hard 90s afternoon',
                'like an old Gloucester side rumbling into the Shed End with the job half done already',
                'with the feel of one of those old West Country Saturdays when the boots were muddy and the crowd already knew the ending'
            ];
            const vintageSpoonRefs = [
                'There will be no open-top bus for that little lot, more a quiet stare into the tea urn behind the old stand.',
                'That is the kind of finish that would have had the old Kingsholm regulars muttering into their programmes.',
                'No silver polish required there, just the sort of shrug you used to see after a long winter away at the Rec.'
            ];
            const randomClassicRef = pickRandomItem(classicGloucesterRefs);
            const randomSpoonRef = pickRandomItem(vintageSpoonRefs);

            let titleLine = '';
            if (winningGroup.length > 1) {
                titleLine = `So there we have it: ${formatNicknameGroup(winningGroup)} have finished locked together on ${leader.points} points at the top, which is exactly the sort of ending the back-page writers dream about.`;
            } else if (!second) {
                titleLine = `So there we have it: ${leader.nickname} has taken the whole thing, and done so without needing much of a photo finish.`;
            } else {
                const gapToSecond = leader.points - second.points;
                titleLine = `So there we have it: ${leader.nickname} has landed the title on ${leader.points} points, finishing ${gapToSecond} clear of ${second.nickname} after keeping the steadiest nerve when the scores were there to be found, ${randomClassicRef}.`;
            }

            let podiumLine = '';
            if (second && third) {
                const secondGap = second.points - third.points;
                if (second.points === third.points) {
                    podiumLine = `${second.nickname} and ${third.nickname} could not be split on ${second.points}, so the chasing pack has ended in a proper scrap all the way to the line, like two old Gloucester forwards refusing to leave a ruck alone in 1989.`;
                } else {
                    podiumLine = `${second.nickname} takes second on ${second.points}, with ${third.nickname} rounding out the podium on ${third.points}${secondGap > 0 ? ` after a final margin of ${secondGap}` : ''}. Not quite enough for the main headline, but enough to stay on the back page all right.`;
                }
            } else if (second) {
                podiumLine = `${second.nickname} has to settle for second, which is handsome work even if it leaves the silverware elsewhere.`;
            }

            let woodenSpoonLine = '';
            if (leaderboardData.length > 1) {
                if (losingGroup.length > 1) {
                    woodenSpoonLine = `At the other end, ${formatNicknameGroup(losingGroup)} share the wooden spoon on ${lastPlace.points} points, which is the kind of distinction nobody wants engraved twice. ${randomSpoonRef}`;
                } else {
                    woodenSpoonLine = `At the other end, ${lastPlace.nickname} picks up the wooden spoon on ${lastPlace.points} points, which is the sort of honour best acknowledged quickly before someone changes the subject. ${randomSpoonRef}`;
                }
            }

            let triesLine = '';
            if (tryWinners.length > 0) {
                if (tryWinners.length === 1) {
                    triesLine = `${formatNicknameGroup(tryWinners)} wins the tries call as well, finishing closest to the actual tournament total of ${actualTries} with a prediction of ${tryWinners[0].predicted}. That is tidy work, the sort of neat read an old Kingsholm scoreboard man would have appreciated.`;
                } else {
                    triesLine = `${formatNicknameGroup(tryWinners)} share the tries honours, all finishing closest to the actual tournament total of ${actualTries}. A proper dead heat, and no complaints from the press box about that.`;
                }
            }

            return `${titleLine} ${podiumLine} ${woodenSpoonLine} ${triesLine}`.replace(/\s+/g, ' ').trim();
        }

        function getTrevsCompletedTournamentSignoff(leaderboardData) {
            if (!isTournamentComplete() || !leaderboardData || leaderboardData.length === 0) return '';

            const winner = leaderboardData[0];
            const currentYear = selectedYear || new Date().getFullYear();
            const nextYear = currentYear + 1;

            return `That's it for ${currentYear}, tune in next year for the ${nextYear} competition under the stewardship of ${winner.nickname}.`;
        }

        function joinStattoExamples(exampleList) {
            const examples = Array.from(new Set((exampleList || []).filter(Boolean)));
            if (examples.length === 0) return '';
            if (examples.length === 1) return ` Example: ${examples[0]}.`;
            if (examples.length === 2) return ` Examples include ${examples[0]} and ${examples[1]}.`;
            return ` Examples include ${examples[0]}, ${examples[1]} and ${examples[2]}.`;
        }

        function joinStattoExamplesIfSmall(totalCount, exampleList) {
            return totalCount > 2 ? '' : joinStattoExamples(exampleList);
        }

        function buildTournamentStattoFacts() {
            const allUsers = getParticipantUsernames();
            const completedScoreMatches = matches.filter(match => match.actualScore1 !== null && match.actualScore2 !== null);
            if (allUsers.length === 0 || completedScoreMatches.length === 0) {
                return ['The Statto is still sharpening the pencil. Once results land, the numbers will start talking.'];
            }

            const rules = getEffectiveScoringRules();
            const statsByUser = {};
            const recentWindowMatchIds = completedScoreMatches.slice(-3).map(match => match.id);
            const fixtureSplitStats = [];
            const upcomingJokerSelections = matches
                .filter(match => match.actualScore1 === null || match.actualScore2 === null)
                .map(match => ({
                    match,
                    usernames: allUsers.filter(username => isUserJokerForMatch(username, match.id))
                }))
                .filter(entry => entry.usernames.length > 0);

            const ensureUserStats = (username) => {
                if (!statsByUser[username]) {
                    statsByUser[username] = {
                        correctResults: 0,
                        exactScores: 0,
                        bonusPoints: 0,
                        contrarianCalls: 0,
                        contrarianCorrect: 0,
                        correctDraws: 0,
                        jokerBonusPoints: 0,
                        jokerHits: 0,
                        recentPoints: 0,
                        currentStreak: 0,
                        nearMisses: 0,
                        closeCalls: 0,
                        correctResultExamples: [],
                        exactScoreExamples: [],
                        bonusExamples: [],
                        contrarianExamples: [],
                        drawExamples: [],
                        jokerExamples: [],
                        recentExamples: [],
                        streakExamples: [],
                        nearMissExamples: [],
                        closeCallExamples: []
                    };
                }
                return statsByUser[username];
            };

            completedScoreMatches.forEach(match => {
                const matchPredictions = allUsers
                    .map(username => {
                        const prediction = users[username] && users[username].predictions
                            ? users[username].predictions[match.id]
                            : null;
                        if (!prediction || !Number.isFinite(prediction.team1) || !Number.isFinite(prediction.team2)) {
                            return null;
                        }

                        return {
                            username,
                            prediction,
                            predictedResult: getResult(prediction.team1, prediction.team2),
                            breakdown: calculateMatchPointsBreakdownWithRules(
                                prediction,
                                match,
                                isUserJokerForMatch(username, match.id),
                                rules
                            )
                        };
                    })
                    .filter(Boolean);

                if (matchPredictions.length === 0) return;

                const supportCounts = { team1: 0, team2: 0, draw: 0 };
                matchPredictions.forEach(entry => {
                    supportCounts[entry.predictedResult] += 1;
                });
                const supportValues = Object.values(supportCounts).filter(count => count > 0);
                const maxSupport = supportValues.length > 0 ? Math.max(...supportValues) : 0;
                const minSupport = supportValues.length > 0 ? Math.min(...supportValues) : 0;

                if (supportValues.length > 1) {
                    fixtureSplitStats.push({
                        match,
                        spread: maxSupport - minSupport,
                        supportCounts,
                        totalPredictions: matchPredictions.length
                    });
                }

                const predictedUsers = new Set(matchPredictions.map(entry => entry.username));
                allUsers.forEach(username => {
                    if (!predictedUsers.has(username)) {
                        ensureUserStats(username).currentStreak = 0;
                    }
                });

                matchPredictions.forEach(entry => {
                    const userStats = ensureUserStats(entry.username);
                    const prediction = entry.prediction;
                    const breakdown = entry.breakdown;
                    const totalDiff = Math.abs(prediction.team1 - match.actualScore1) + Math.abs(prediction.team2 - match.actualScore2);

                    if (breakdown.correctResult) userStats.correctResults += 1;
                    if (breakdown.correctResult) {
                        userStats.correctResultExamples.push(`${getStattoDisplayName(entry.username)} calling ${formatActualScoreline(match)}`);
                    }
                    if (breakdown.perfectScore) {
                        userStats.exactScores += 1;
                        userStats.exactScoreExamples.push(`${getStattoDisplayName(entry.username)} nailing ${formatActualScoreline(match)}`);
                    }
                    if (breakdown.drawBonus > 0) {
                        userStats.correctDraws += 1;
                        userStats.drawExamples.push(`${getStattoDisplayName(entry.username)} landing ${prediction.team1}-${prediction.team2} in ${match.team1} vs ${match.team2}`);
                    }
                    if (!breakdown.perfectScore && (breakdown.team1CloseBonus > 0 || breakdown.team2CloseBonus > 0)) {
                        userStats.closeCalls += 1;
                        userStats.closeCallExamples.push(`${getStattoDisplayName(entry.username)} going ${prediction.team1}-${prediction.team2} on an actual ${match.actualScore1}-${match.actualScore2} in ${match.team1} vs ${match.team2}`);
                    }
                    if (breakdown.jokerApplied) {
                        userStats.jokerHits += 1;
                        userStats.jokerBonusPoints += breakdown.basePoints;
                        userStats.jokerExamples.push(`${getStattoDisplayName(entry.username)} doubling ${prediction.team1}-${prediction.team2} in ${match.team1} vs ${match.team2}`);
                    }
                    if (!breakdown.perfectScore && totalDiff <= 2) {
                        userStats.nearMisses += 1;
                        userStats.nearMissExamples.push(`${getStattoDisplayName(entry.username)} going ${prediction.team1}-${prediction.team2} when ${formatActualScoreline(match)} was the final score`);
                    }

                    const baseResultPoints = breakdown.correctResult ? (Number(rules.correctResultPoints) || 0) : 0;
                    const extraPoints = Math.max(0,
                        breakdown.points
                        - (breakdown.jokerApplied ? baseResultPoints * 2 : baseResultPoints)
                    );
                    userStats.bonusPoints += extraPoints;
                    if (extraPoints > 0) {
                        userStats.bonusExamples.push(`${getStattoDisplayName(entry.username)} squeezing ${extraPoints} extra point${extraPoints === 1 ? '' : 's'} from ${prediction.team1}-${prediction.team2} in ${match.team1} vs ${match.team2}`);
                    }

                    if (supportCounts[entry.predictedResult] > 0 && supportCounts[entry.predictedResult] < maxSupport) {
                        userStats.contrarianCalls += 1;
                        userStats.contrarianExamples.push(formatPredictedOutcomeSnippet(entry.username, match, entry.predictedResult, prediction));
                        if (breakdown.correctResult) userStats.contrarianCorrect += 1;
                    }

                    if (recentWindowMatchIds.includes(match.id)) {
                        userStats.recentPoints += breakdown.points;
                        if (breakdown.points > 0) {
                            userStats.recentExamples.push(`${getStattoDisplayName(entry.username)} taking ${breakdown.points} point${breakdown.points === 1 ? '' : 's'} from ${prediction.team1}-${prediction.team2} in ${match.team1} vs ${match.team2}`);
                        }
                    }

                    if (breakdown.correctResult) {
                        userStats.currentStreak += 1;
                        userStats.streakExamples.push(`${getStattoDisplayName(entry.username)} reading ${formatActualScoreline(match)} correctly`);
                    } else {
                        userStats.currentStreak = 0;
                        userStats.streakExamples = [];
                    }
                });
            });

            const topUsersFor = (metric, minValue = 1) => {
                const values = allUsers.map(username => ({
                    username,
                    value: statsByUser[username] ? statsByUser[username][metric] : 0
                }));
                const best = values.reduce((max, entry) => Math.max(max, entry.value), 0);
                if (best < minValue) return null;
                return {
                    value: best,
                    usernames: values.filter(entry => entry.value === best).map(entry => entry.username)
                };
            };
            const gatherExamples = (usernames, field, limit = 2) => Array.from(new Set(
                (usernames || []).flatMap(username => {
                    const stats = statsByUser[username];
                    return stats && Array.isArray(stats[field]) ? stats[field] : [];
                })
            )).slice(0, limit);

            const factCandidates = [];
            const correctResultsLeader = topUsersFor('correctResults');
            if (correctResultsLeader) {
                factCandidates.push(`${formatStatNameList(correctResultsLeader.usernames)} ${correctResultsLeader.usernames.length === 1 ? 'has' : 'have'} picked the most outright results correctly with ${correctResultsLeader.value}.${joinStattoExamplesIfSmall(correctResultsLeader.value, gatherExamples(correctResultsLeader.usernames, 'correctResultExamples'))}`);
            }

            const exactScoresLeader = topUsersFor('exactScores');
            if (exactScoresLeader) {
                factCandidates.push(`${formatStatNameList(exactScoresLeader.usernames)} ${exactScoresLeader.usernames.length === 1 ? 'leads' : 'lead'} the exact-score chart with ${exactScoresLeader.value}.${joinStattoExamplesIfSmall(exactScoresLeader.value, gatherExamples(exactScoresLeader.usernames, 'exactScoreExamples'))}`);
            }

            const bonusLeader = topUsersFor('bonusPoints');
            if (bonusLeader) {
                factCandidates.push(`${formatStatNameList(bonusLeader.usernames)} ${bonusLeader.usernames.length === 1 ? 'has banked' : 'have banked'} the biggest bonus haul so far with ${bonusLeader.value} extra point${bonusLeader.value === 1 ? '' : 's'}.${joinStattoExamplesIfSmall(bonusLeader.value, gatherExamples(bonusLeader.usernames, 'bonusExamples'))}`);
            }

            const contrarianLeader = topUsersFor('contrarianCalls');
            if (contrarianLeader) {
                factCandidates.push(`${formatStatNameList(contrarianLeader.usernames)} ${contrarianLeader.usernames.length === 1 ? 'owns' : 'own'} the boldest prediction sheet with ${contrarianLeader.value} contrarian call${contrarianLeader.value === 1 ? '' : 's'}.${joinStattoExamplesIfSmall(contrarianLeader.value, gatherExamples(contrarianLeader.usernames, 'contrarianExamples'))}`);
            }

            const loneUpcomingJoker = upcomingJokerSelections.find(entry => entry.usernames.length === 1);
            if (loneUpcomingJoker) {
                factCandidates.push(`${formatStatNameList(loneUpcomingJoker.usernames)} ${loneUpcomingJoker.usernames.length === 1 ? 'is' : 'are'} the lone voice on the upcoming joker sheet, standing alone on ${loneUpcomingJoker.match.team1} vs ${loneUpcomingJoker.match.team2}.`);
            } else if (upcomingJokerSelections.length > 0) {
                const mostPopularUpcomingJoker = upcomingJokerSelections
                    .slice()
                    .sort((a, b) => b.usernames.length - a.usernames.length || a.match.id - b.match.id)[0];
                factCandidates.push(`${mostPopularUpcomingJoker.match.team1} vs ${mostPopularUpcomingJoker.match.team2} is currently the hottest upcoming joker fixture, with ${mostPopularUpcomingJoker.usernames.length} player${mostPopularUpcomingJoker.usernames.length === 1 ? '' : 's'} piled in.`);
            }

            const contrarianRateEntries = allUsers
                .map(username => {
                    const stats = statsByUser[username] || {};
                    const attempts = stats.contrarianCalls || 0;
                    const wins = stats.contrarianCorrect || 0;
                    return attempts >= 2 ? { username, rate: wins / attempts, wins, attempts } : null;
                })
                .filter(Boolean)
                .sort((a, b) => b.rate - a.rate || b.wins - a.wins || a.username.localeCompare(b.username));
            if (contrarianRateEntries.length > 0 && contrarianRateEntries[0].rate > 0) {
                const bestRate = contrarianRateEntries[0].rate;
                const bestEntries = contrarianRateEntries.filter(entry => entry.rate === bestRate && entry.wins === contrarianRateEntries[0].wins);
                const bestUsernames = bestEntries.map(entry => entry.username);
                factCandidates.push(`${formatStatNameList(bestUsernames)} ${bestEntries.length === 1 ? 'is' : 'are'} the sharpest outsider${bestEntries.length === 1 ? '' : 's'}, landing ${Math.round(bestRate * 100)}% of contrarian calls right.${joinStattoExamplesIfSmall(bestEntries[0].attempts, gatherExamples(bestUsernames, 'contrarianExamples'))}`);
            }

            const drawLeader = topUsersFor('correctDraws');
            if (drawLeader) {
                factCandidates.push(`${formatStatNameList(drawLeader.usernames)} ${drawLeader.usernames.length === 1 ? 'is' : 'are'} the draw specialist${drawLeader.usernames.length === 1 ? '' : 's'} with ${drawLeader.value} correct stalemate call${drawLeader.value === 1 ? '' : 's'}.${joinStattoExamplesIfSmall(drawLeader.value, gatherExamples(drawLeader.usernames, 'drawExamples'))}`);
            }

            const jokerLeader = topUsersFor('jokerBonusPoints');
            if (jokerLeader) {
                factCandidates.push(`${formatStatNameList(jokerLeader.usernames)} ${jokerLeader.usernames.length === 1 ? 'has squeezed' : 'have squeezed'} the most from joker selections, adding ${jokerLeader.value} bonus point${jokerLeader.value === 1 ? '' : 's'}.${joinStattoExamplesIfSmall(jokerLeader.value, gatherExamples(jokerLeader.usernames, 'jokerExamples'))}`);
            }

            const recentFormLeader = topUsersFor('recentPoints');
            if (recentFormLeader) {
                factCandidates.push(`Over the last ${recentWindowMatchIds.length} completed match${recentWindowMatchIds.length === 1 ? '' : 'es'}, ${formatStatNameList(recentFormLeader.usernames)} ${recentFormLeader.usernames.length === 1 ? 'has' : 'have'} been the form side of the competition with ${recentFormLeader.value} point${recentFormLeader.value === 1 ? '' : 's'}.${joinStattoExamplesIfSmall(recentWindowMatchIds.length, gatherExamples(recentFormLeader.usernames, 'recentExamples'))}`);
            }

            const streakLeader = topUsersFor('currentStreak');
            if (streakLeader) {
                factCandidates.push(`${formatStatNameList(streakLeader.usernames)} ${streakLeader.usernames.length === 1 ? 'is' : 'are'} riding the longest current correct-result streak at ${streakLeader.value}.${joinStattoExamplesIfSmall(streakLeader.value, gatherExamples(streakLeader.usernames, 'streakExamples', 1))}`);
            }

            const nearMissLeader = topUsersFor('nearMisses');
            if (nearMissLeader) {
                factCandidates.push(`${formatStatNameList(nearMissLeader.usernames)} ${nearMissLeader.usernames.length === 1 ? 'has come' : 'have come'} closest to perfect scorelines, with ${nearMissLeader.value} prediction${nearMissLeader.value === 1 ? '' : 's'} finishing within two points overall.${joinStattoExamplesIfSmall(nearMissLeader.value, gatherExamples(nearMissLeader.usernames, 'nearMissExamples'))}`);
            }

            if (factCandidates.length < 10) {
                const closeCallLeader = topUsersFor('closeCalls');
                if (closeCallLeader) {
                    factCandidates.push(`${formatStatNameList(closeCallLeader.usernames)} ${closeCallLeader.usernames.length === 1 ? 'has turned' : 'have turned'} the most almost-there reads into close-score bonuses with ${closeCallLeader.value}.${joinStattoExamplesIfSmall(closeCallLeader.value, gatherExamples(closeCallLeader.usernames, 'closeCallExamples'))}`);
                }
            }

            if (factCandidates.length < 10 && fixtureSplitStats.length > 0) {
                const mostSplit = fixtureSplitStats.sort((a, b) => a.spread - b.spread || b.totalPredictions - a.totalPredictions)[0];
                if (mostSplit) {
                    factCandidates.push(`${mostSplit.match.team1} vs ${mostSplit.match.team2} has been the most divided fixture so far, with the room split ${mostSplit.supportCounts.team1}/${mostSplit.supportCounts.team2}/${mostSplit.supportCounts.draw} across home win, away win and draw calls.`);
                }
            }

            const availableFacts = factCandidates.filter(Boolean);
            if (availableFacts.length === 0) {
                return ['The Statto is still sharpening the pencil. Once results land, the numbers will start talking.'];
            }
            return availableFacts;
        }

        function getStaticStattoFact(facts) {
            if (!facts || facts.length === 0) {
                return 'The Statto is still sharpening the pencil. Once results land, the numbers will start talking.';
            }
            if (stattoFactIndex === null) {
                stattoFactIndex = Math.floor(Math.random() * facts.length);
            }
            return facts[stattoFactIndex % facts.length];
        }

        function pickRandomItem(list) {
            if (!Array.isArray(list) || list.length === 0) return '';
            return list[Math.floor(Math.random() * list.length)];
        }

        function getTrevsTipsLoadout() {
            if (trevsTipsLoadout) return trevsTipsLoadout;

            const leadIns = [
                'Stop the presses',
                'From the back page desk',
                'After another rattle round the grounds',
                'A fresh edition of Trev\'s Tips reports',
                'The latest word from the Guesser press box'
            ];
            const soloOpeners = [
                'is currently a one-person headline',
                'has the column all to themselves',
                'is writing the only byline in town',
                'is monopolising the sports pages'
            ];
            const minorityOpeners = [
                'The bold call belongs to',
                'The daring prediction comes from',
                'The contrarian line is being taken by',
                'The brave souls in this edition are'
            ];
            const noPredictionLines = [
                'the copy desk is still waiting for the first scoreline to come in',
                'the predictions page is still blank for now',
                'nobody has filed a scoreline with the desk just yet'
            ];
            const splitLeads = [
                'The prediction desk currently reads',
                'The early print run reads',
                'The current verdict from the room is',
                'The first count on the prediction slips reads'
            ];

            trevsTipsLoadout = {
                aiCrowdAside: getAiCrowdAside(),
                leadIn: pickRandomItem(leadIns),
                soloOpener: pickRandomItem(soloOpeners),
                minorityOpener: pickRandomItem(minorityOpeners),
                noPredictionLine: pickRandomItem(noPredictionLines),
                splitLead: pickRandomItem(splitLeads),
                gloucesterRef1: pickRandomItem([
                    "showing the kind of form Gloucester had in the 2002-03 Zurich Premiership",
                    "more dominant than Gloucester's pack on a muddy Kingsholm afternoon",
                    "channeling serious Cherry and White energy",
                    "playing it tighter than a Gloucester maul five metres out",
                    "with the precision of a prime James Simpson-Daniel sidestep",
                    "looking sharper than Mike Teague on a charge against the All Blacks",
                    "more relentless than a Kingsholm crowd in full voice on a Friday night",
                    "as solid as the Shed End faithful in December",
                    "with the guile of a young Jeremy Guscott cutting through the defence",
                    "fiercer than the Bath-Gloucester derby in the 80s",
                    "tougher than playing at the Rec in February without gloves",
                    "more committed than Phil Vickery scrummaging on a wet Wednesday",
                    "steadier than Don Caskie slotting penalties in the wind",
                    "showing more heart than Gloucester's 2003 Powergen Cup final win",
                    "hungrier than a young Olly Morgan chasing a high ball",
                    "more unpredictable than a Friday night under the lights at Kingsholm",
                    "with the power of the Cherry and Whites in their Heineken Cup days",
                    "as fearless as Marcel Garvey running at a full defence",
                    "with the footwork of Terry Fanolua dancing through tackles",
                    "hitting harder than Junior Paramore on a rampaging burst",
                    "showing the consistency of Andy Gomarsall's box kicking",
                    "as reliable as Henry Paul pulling the strings at fly-half",
                    "more clinical than Ludovic Mercier slotting kicks from the touchline",
                    "with the vision of Ryan Lamb spotting gaps in the defence",
                    "as explosive as Lesley Vainikolo in full flight down the wing",
                    "tougher than the Kingsholm pitch after a week of West Country rain",
                    "showing the never-say-die attitude of the 2006-07 EDF Energy Cup winners",
                    "as fired up as Kingsholm on derby day against Bath",
                    "with the composure of Greig Laidlaw knocking over late pressure kicks in Cherry and White",
                    "as clinical as Charlie Sharples finishing in the corner at full pace",
                    "like Gloucester in full flow during those Heineken Cup nights under the lights"
                ]),
                gloucesterRef2: pickRandomItem([
                    "showing the kind of form Gloucester had in the 2002-03 Zurich Premiership",
                    "more dominant than Gloucester's pack on a muddy Kingsholm afternoon",
                    "channeling serious Cherry and White energy",
                    "playing it tighter than a Gloucester maul five metres out",
                    "with the precision of a prime James Simpson-Daniel sidestep",
                    "looking sharper than Mike Teague on a charge against the All Blacks",
                    "more relentless than a Kingsholm crowd in full voice on a Friday night",
                    "as solid as the Shed End faithful in December",
                    "with the guile of a young Jeremy Guscott cutting through the defence",
                    "fiercer than the Bath-Gloucester derby in the 80s",
                    "tougher than playing at the Rec in February without gloves",
                    "more committed than Phil Vickery scrummaging on a wet Wednesday",
                    "steadier than Don Caskie slotting penalties in the wind",
                    "showing more heart than Gloucester's 2003 Powergen Cup final win",
                    "hungrier than a young Olly Morgan chasing a high ball",
                    "more unpredictable than a Friday night under the lights at Kingsholm",
                    "with the power of the Cherry and Whites in their Heineken Cup days",
                    "as fearless as Marcel Garvey running at a full defence",
                    "with the footwork of Terry Fanolua dancing through tackles",
                    "hitting harder than Junior Paramore on a rampaging burst",
                    "showing the consistency of Andy Gomarsall's box kicking",
                    "as reliable as Henry Paul pulling the strings at fly-half",
                    "more clinical than Ludovic Mercier slotting kicks from the touchline",
                    "with the vision of Ryan Lamb spotting gaps in the defence",
                    "as explosive as Lesley Vainikolo in full flight down the wing",
                    "tougher than the Kingsholm pitch after a week of West Country rain",
                    "showing the never-say-die attitude of the 2006-07 EDF Energy Cup winners",
                    "as fired up as Kingsholm on derby day against Bath",
                    "with the composure of Greig Laidlaw knocking over late pressure kicks in Cherry and White",
                    "as clinical as Charlie Sharples finishing in the corner at full pace",
                    "like Gloucester in full flow during those Heineken Cup nights under the lights"
                ]),
                worldCupClassic: pickRandomItem([
                    "the 1995 World Cup final in Johannesburg",
                    "France's stunning comeback against New Zealand in the 1999 World Cup semi-final",
                    "Jonny Wilkinson's 2003 World Cup final drop goal in Sydney",
                    "France v New Zealand in the 2007 World Cup quarter-final in Cardiff",
                    "the 2007 World Cup final arm wrestle between South Africa and England"
                ]),
                internationalClassic: pickRandomItem([
                    "Wales v Scotland with the roof shut and the noise bouncing off the Millennium Stadium",
                    "England v France when the whole thing feels one dropped ball away from chaos",
                    "Ireland v Wales on a cold Dublin afternoon with everything on the line",
                    "Scotland v England when the Calcutta Cup gets properly feral",
                    "France v Ireland when every phase looks like it might end up on a highlights reel"
                ])
            };
            return trevsTipsLoadout;
        }

        function getTrevsTipsDisplayName(username) {
            const displayName = getDisplayName(username);
            return isAiPlayer(username) ? formatAiDisplayName(displayName) : displayName;
        }

        // Update leaderboard
        function updateLeaderboard() {
            // Update tries stats and Trev's Tips
            updateTriesStats();
        }

        // Update the tries stats display above leaderboard
        function updateTriesStats() {
            const container = document.getElementById('triesStatsContainer');
            if (!container) return;
            
            const totalActualTries = getTotalActualTries();
            const completedMatches = matches.filter(m => m.actualTries1 !== null && m.actualTries2 !== null).length;
            const totalMatches = matches.length;
            const remainingMatches = totalMatches - completedMatches;
            
            let estimatedTotal = '-';
            let avgPerMatch = '-';
            
            if (completedMatches > 0) {
                avgPerMatch = (totalActualTries / completedMatches).toFixed(1);
                estimatedTotal = Math.round((totalActualTries / completedMatches) * totalMatches);
            }
            const stattoFacts = buildTournamentStattoFacts();
            const initialStattoFact = getStaticStattoFact(stattoFacts);
            
            container.innerHTML = `
                <div class="tries-stats-title">Tournament Stats</div>
                <div class="tries-stats-grid">
                    <div class="tries-stat">
                        <div class="tries-stat-value">${totalActualTries}</div>
                        <div class="tries-stat-label">Tries So Far</div>
                    </div>
                    <div class="tries-stat">
                        <div class="tries-stat-value">${completedMatches}/${totalMatches}</div>
                        <div class="tries-stat-label">Matches Completed</div>
                    </div>
                    <div class="tries-stat">
                        <div class="tries-stat-value">${avgPerMatch}</div>
                        <div class="tries-stat-label">Avg Per Match</div>
                    </div>
                    <div class="tries-stat">
                        <div class="tries-stat-value">${estimatedTotal}</div>
                        <div class="tries-stat-label">Estimated Total</div>
                    </div>
                </div>
                <div class="statto-callout">
                    <div class="statto-title">The Statto</div>
                    <div class="statto-body">${initialStattoFact}</div>
                </div>
            `;
            
            // Update Trev's Tips
            updateTrevsTips();
        }

        // Generate Trev's Tips - fun commentary on the competition
        function updateTrevsTips() {
            const container = document.getElementById('trevsTipsContainer');
            if (!container) return;
            
            const allUsers = getParticipantUsernames();
            if (allUsers.length === 0) {
                container.innerHTML = '';
                return;
            }
            const trevsLoadout = getTrevsTipsLoadout();
            let hasUsedTrevsAiAside = false;
            const getScopedTrevsTipsDisplayName = (username) => {
                const displayName = getDisplayName(username);
                if (!isAiPlayer(username)) return displayName;
                if (hasUsedTrevsAiAside) return displayName;
                hasUsedTrevsAiAside = true;
                return formatAiDisplayName(displayName, trevsLoadout.aiCrowdAside);
            };
            
            // Get leaderboard data
            const leaderboardData = allUsers.map(username => ({
                nickname: getScopedTrevsTipsDisplayName(username),
                points: calculatePoints(username),
                username: username
            })).sort((a, b) => b.points - a.points);
            
            // Get completed matches with results
            const completedMatches = matches.filter(m => m.actualScore1 !== null && m.actualScore2 !== null);
            const recentMatch = completedMatches.length > 0 ? completedMatches[completedMatches.length - 1] : null;
            
            // Generate tips based on current state
            let tip = '';
            
            const randomGloucester = trevsLoadout.gloucesterRef1;
            const randomGloucester2 = trevsLoadout.gloucesterRef2;
            const randomWorldCupClassic = trevsLoadout.worldCupClassic;
            const randomInternationalClassic = trevsLoadout.internationalClassic;
            const nextMatch = matches.find(m => m.actualScore1 === null || m.actualScore2 === null);
            const formatHighlightedNameList = (nameList) => {
                if (!nameList || nameList.length === 0) return '';
                if (nameList.length === 1) return nameList[0];
                if (nameList.length === 2) return `${nameList[0]} and ${nameList[1]}`;
                if (nameList.length === 3) return `${nameList[0]}, ${nameList[1]} and ${nameList[2]}`;
                return `${nameList.slice(0, 3).join(', ')} and ${nameList.length - 3} others`;
            };

            let nextMatchPredictionSummary = '';
            if (nextMatch) {
                const nextPredictions = allUsers
                    .map(username => ({
                        username,
                        nickname: getScopedTrevsTipsDisplayName(username),
                        prediction: users[username] && users[username].predictions
                            ? users[username].predictions[nextMatch.id]
                            : null
                    }))
                    .filter(entry => entry.prediction &&
                        Number.isFinite(entry.prediction.team1) &&
                        Number.isFinite(entry.prediction.team2));

                if (nextPredictions.length === 0) {
                    nextMatchPredictionSummary = `Eyes now turn to ${nextMatch.team1} vs ${nextMatch.team2} on ${nextMatch.date} at ${nextMatch.time}, but ${trevsLoadout.noPredictionLine}.`;
                } else {
                    const team1Winners = [];
                    const team2Winners = [];
                    const drawPickers = [];

                    nextPredictions.forEach(entry => {
                        const predictedResult = getResult(entry.prediction.team1, entry.prediction.team2);
                        if (predictedResult === 'team1') {
                            team1Winners.push(entry.nickname);
                        } else if (predictedResult === 'team2') {
                            team2Winners.push(entry.nickname);
                        } else {
                            drawPickers.push(entry.nickname);
                        }
                    });

                    const totalPredictions = nextPredictions.length;
                    if (team1Winners.length === totalPredictions) {
                        nextMatchPredictionSummary = `Attention now shifts to ${nextMatch.team1} vs ${nextMatch.team2} on ${nextMatch.date} at ${nextMatch.time}. The prediction split is as one-sided as a Friday night roar from the Shed: all ${totalPredictions} players are backing ${nextMatch.team1}.`;
                    } else if (team2Winners.length === totalPredictions) {
                        nextMatchPredictionSummary = `Attention now shifts to ${nextMatch.team1} vs ${nextMatch.team2} on ${nextMatch.date} at ${nextMatch.time}. The prediction split is absolute: all ${totalPredictions} players are backing ${nextMatch.team2}, which is the kind of consensus usually reserved for a nailed-on kick in front of the posts.`;
                    } else if (drawPickers.length === totalPredictions) {
                        nextMatchPredictionSummary = `Attention now shifts to ${nextMatch.team1} vs ${nextMatch.team2} on ${nextMatch.date} at ${nextMatch.time}. Every single predictor is calling it a draw, a wonderfully old-school verdict that would not look out of place alongside ${randomInternationalClassic}.`;
                    } else {
                        const splitParts = [];
                        if (team1Winners.length > 0) splitParts.push(`${team1Winners.length} backing ${nextMatch.team1}`);
                        if (team2Winners.length > 0) splitParts.push(`${team2Winners.length} backing ${nextMatch.team2}`);
                        if (drawPickers.length > 0) splitParts.push(`${drawPickers.length} calling it a draw`);

                        const resultGroups = [
                            { type: 'team1', label: nextMatch.team1, names: team1Winners },
                            { type: 'team2', label: nextMatch.team2, names: team2Winners },
                            { type: 'draw', label: 'the draw', names: drawPickers }
                        ].filter(group => group.names.length > 0)
                            .sort((a, b) => a.names.length - b.names.length);
                        const minorityGroup = resultGroups.find(group => group.names.length > 0 && group.names.length < 3 && group.names.length < totalPredictions);
                        let minorityCommentary = '';
                        if (minorityGroup) {
                            const target = minorityGroup.type === 'draw' ? 'a stalemate' : minorityGroup.label;
                            minorityCommentary = ` ${trevsLoadout.minorityOpener} ${formatHighlightedNameList(minorityGroup.names)}, making ${minorityGroup.names.length === 1 ? 'a daring prediction' : 'some properly daring predictions'} for ${target} while most of the room is heading the other way.`;
                        }
                        nextMatchPredictionSummary = splitParts.length > 0
                            ? `Attention now shifts to ${nextMatch.team1} vs ${nextMatch.team2} on ${nextMatch.date} at ${nextMatch.time}. ${trevsLoadout.splitLead} ${splitParts.join(', ')}.${minorityCommentary} It has the feel of ${randomInternationalClassic}, with every chance that one contrarian shout ends up looking inspired by full-time.`
                            : `Eyes now turn to ${nextMatch.team1} vs ${nextMatch.team2} on ${nextMatch.date} at ${nextMatch.time}, but ${trevsLoadout.noPredictionLine}.`;
                    }
                }
            }
            const completedTournamentSection = buildTrevsCompletedTournamentSection(leaderboardData);
            const completedTournamentSignoff = getTrevsCompletedTournamentSignoff(leaderboardData);
            const finalRoundRunInSection = completedTournamentSection || buildTrevsRunInSection(leaderboardData, allUsers, getScopedTrevsTipsDisplayName);
            const isCompletedTournamentTips = !!completedTournamentSection;
            const nextFixtureWithHistory = [nextMatchPredictionSummary].filter(Boolean).join(' ');
            const nextFixtureParagraph = nextFixtureWithHistory ? `<br><br>${nextFixtureWithHistory}` : '';
            const finalRoundRunInParagraph = finalRoundRunInSection ? `<br><br>${finalRoundRunInSection}` : '';
            const completedTournamentSignoffParagraph = completedTournamentSignoff ? `<br><br>${completedTournamentSignoff}` : '';
            const standardSecondParagraph = (text) => finalRoundRunInSection ? finalRoundRunInParagraph : `<br><br>${text}`;
            
            if (completedMatches.length === 0) {
                tip = `The presses are humming, but we have not had a ball kicked in anger yet. The mood is building like ${randomWorldCupClassic}, with every competitor convinced they have spotted the winning read before anyone else. Get those predictions filed before kick-off because this paper is not accepting late copy once the whistle goes. Call a draw correctly and you pocket a handy bonus; land the exact score and you will be strutting about like Gloucester have just lifted silverware again.${nextFixtureParagraph}`;
            } else if (leaderboardData.length === 1) {
                tip = `${leaderboardData[0].nickname} ${trevsLoadout.soloOpener}, ${randomGloucester}. Admirable stuff, but it is a lonely old back page when there is nobody else to chase. Round up a few more entrants and turn this into the sort of proper scrap that gets Kingsholm muttering over the tea urn.${nextFixtureParagraph}`;
            } else {
                const leader = leaderboardData[0];
                const second = leaderboardData[1];
                const gap = leader.points - second.points;
                const remainingMatches = matches.length - completedMatches.length;
                const scoreGroups = {};
                leaderboardData.forEach(entry => {
                    if (!scoreGroups[entry.points]) scoreGroups[entry.points] = [];
                    scoreGroups[entry.points].push(entry.nickname);
                });

                const multiWayTies = Object.keys(scoreGroups)
                    .map(points => ({ points: parseInt(points, 10), names: scoreGroups[points] }))
                    .filter(group => group.names.length >= 3)
                    .sort((a, b) => b.points - a.points);

                let tieAnalysis = '';
                if (multiWayTies.length > 0) {
                    const tie = multiWayTies[0];
                    tieAnalysis = `${tie.names.join(', ')} are all locked together on ${tie.points} points - that's a proper ${tie.names.length}-way tie. `;
                    if (multiWayTies.length > 1) {
                        tieAnalysis += `And it's not just them - there are multiple score ties right across the table. `;
                    }
                }

                let bottomTableAnalysis = '';
                if (leaderboardData.length >= 4) {
                    const bottomSlice = leaderboardData.slice(-3);
                    const bottomNames = bottomSlice.map(entry => entry.nickname).join(', ');
                    const lastEntry = leaderboardData[leaderboardData.length - 1];
                    const secondLast = leaderboardData[leaderboardData.length - 2];
                    const aboveBottom = leaderboardData[leaderboardData.length - 4];

                    if (lastEntry.points === secondLast.points) {
                        bottomTableAnalysis = `Down near the bottom it's tight between ${bottomNames}, all scrapping for every point. `;
                    } else if (aboveBottom && (aboveBottom.points - lastEntry.points) <= 3) {
                        bottomTableAnalysis = `Even at the foot of the table it's close - ${bottomNames} are only a good prediction away from climbing places. `;
                    } else {
                        bottomTableAnalysis = `${bottomNames} are chasing hard from the lower end of the table and one strong round could shake everything up. `;
                    }
                }
                
                // Build match analysis with more detail
                let matchAnalysis = '';
                if (completedMatches.length > 0) {
                    const recentMatch = completedMatches[completedMatches.length - 1];
                    const scoreDiff = Math.abs(recentMatch.actualScore1 - recentMatch.actualScore2);
                    const totalPoints = recentMatch.actualScore1 + recentMatch.actualScore2;
                    const winner = recentMatch.actualScore1 > recentMatch.actualScore2 ? recentMatch.team1 : 
                                   recentMatch.actualScore2 > recentMatch.actualScore1 ? recentMatch.team2 : null;
                    const loser = recentMatch.actualScore1 < recentMatch.actualScore2 ? recentMatch.team1 : 
                                  recentMatch.actualScore2 < recentMatch.actualScore1 ? recentMatch.team2 : null;
                    
                    if (winner) {
                        if (scoreDiff > 30) {
                            matchAnalysis = `Blimey! ${winner} absolutely annihilated ${loser} ${recentMatch.actualScore1}-${recentMatch.actualScore2} - that's the kind of hammering you don't see often in international rugby! ${loser} will want to forget that one quickly. Reminds me of when the All Blacks used to put 50 on teams in the early 2000s. `;
                        } else if (scoreDiff > 20) {
                            matchAnalysis = `${winner} put ${loser} to the sword with a dominant ${recentMatch.actualScore1}-${recentMatch.actualScore2} victory - a proper thrashing that would make the old Kingsholm faithful proud! ${loser} had no answer to that kind of pressure. Anyone who predicted that margin deserves a pint! `;
                        } else if (scoreDiff > 10) {
                            matchAnalysis = `${winner} claimed a convincing ${recentMatch.actualScore1}-${recentMatch.actualScore2} win over ${loser}. A solid performance that showed real class and composure when it mattered. ${loser} competed but couldn't live with ${winner}'s intensity in the key moments. `;
                        } else if (scoreDiff <= 3) {
                            matchAnalysis = `What a nail-biter! ${winner} scraped past ${loser} ${recentMatch.actualScore1}-${recentMatch.actualScore2} - tighter than a Gloucester scrum on their own five-metre line! Could have gone either way right until the final whistle. That's the kind of match that makes this tournament special. If you got that result right, take a bow! `;
                        } else {
                            matchAnalysis = `${winner} edged out ${loser} ${recentMatch.actualScore1}-${recentMatch.actualScore2} in a hard-fought contest. Neither side gave an inch, proper Test match rugby that was. ${loser} will feel they let that one slip, but ${winner} showed composure when it counted. `;
                        }
                        
                        // High scoring game
                        if (totalPoints > 60) {
                            matchAnalysis += `A ${totalPoints}-point thriller - the defences will be getting a talking to after that one! `;
                        } else if (totalPoints < 25) {
                            matchAnalysis += `Low-scoring but brutal - a real arm-wrestle between two tough teams. `;
                        }
                    } else {
                        matchAnalysis = `A ${recentMatch.actualScore1}-${recentMatch.actualScore2} draw between ${recentMatch.team1} and ${recentMatch.team2}! You don't see many of those in international rugby - rarer than a sunny day at Kingsholm in February! If anyone predicted that exact score, they deserve a standing ovation from the Shed. That's seriously impressive prediction work. `;
                    }
                    
                    // Add tries analysis if available
                    if (recentMatch.actualTries1 !== null && recentMatch.actualTries2 !== null) {
                        const totalTries = recentMatch.actualTries1 + recentMatch.actualTries2;
                        if (totalTries >= 10) {
                            matchAnalysis += `${totalTries} tries in one match - that's an absolute try-fest! The kind of rugby we all want to see. `;
                        } else if (totalTries >= 8) {
                            matchAnalysis += `${totalTries} tries in total - proper running rugby that keeps the crowd on their feet! `;
                        } else if (totalTries <= 2) {
                            matchAnalysis += `Only ${totalTries} tries though - a real forwards' battle that one, the kind of game where every scrum matters. `;
                        } else if (totalTries <= 4) {
                            matchAnalysis += `${totalTries} tries tells you it was tight and tense - defences on top throughout. `;
                        }
                    }
                }
                
                // Who predicted well in recent match
                let predictionAnalysis = '';
                if (recentMatch) {
                    const correctPredictions = allUsers.filter(username => {
                        const pred = users[username].predictions[recentMatch.id];
                        if (!pred) return false;
                        const actualResult = getResult(recentMatch.actualScore1, recentMatch.actualScore2);
                        const predictedResult = getResult(pred.team1, pred.team2);
                        return actualResult === predictedResult;
                    });
                    
                    if (correctPredictions.length === 0) {
                        predictionAnalysis = `Nobody got that result right - ${recentMatch.team1} vs ${recentMatch.team2} caught everyone out! `;
                    } else if (correctPredictions.length === 1) {
                        const winner = getScopedTrevsTipsDisplayName(correctPredictions[0]);
                        predictionAnalysis = `Only ${winner} called that one correctly - sharp stuff! `;
                    } else if (correctPredictions.length <= 3) {
                        predictionAnalysis = `Only ${correctPredictions.length} competitors got the result right - not an easy one to call! `;
                    }
                }
                
                if (gap === 0) {
                    tip = isCompletedTournamentTips
                        ? `${completedTournamentSection}${completedTournamentSignoffParagraph}`
                        : `${trevsLoadout.leadIn}: ${leader.nickname} and ${second.nickname} are locked together at the top on ${leader.points} points, ${randomGloucester}. ${matchAnalysis}${predictionAnalysis}${standardSecondParagraph(`${tieAnalysis}${bottomTableAnalysis}With ${remainingMatches} matches still to play, the Guesser has the pulse of a proper title decider. One inspired scoreline and the whole story gets rewritten before the next edition.`)}${completedTournamentSignoffParagraph}${nextFixtureParagraph}`;
                } else if (gap <= 3) {
                    tip = isCompletedTournamentTips
                        ? `${completedTournamentSection}${completedTournamentSignoffParagraph}`
                        : `${leader.nickname} still has the headline on ${leader.points} points, but ${second.nickname} is right on the shoulder with only ${gap} point${gap > 1 ? 's' : ''} in it, like a Gloucester flanker sniffing around a loose carry. ${matchAnalysis}${predictionAnalysis}${standardSecondParagraph(`${tieAnalysis}${bottomTableAnalysis}With ${remainingMatches} matches left, one good round of predictions could turn the whole table on its head. It has the late-drama feel of ${randomWorldCupClassic}.`)}${completedTournamentSignoffParagraph}${nextFixtureParagraph}`;
                } else if (gap <= 6) {
                    tip = isCompletedTournamentTips
                        ? `${completedTournamentSection}${completedTournamentSignoffParagraph}`
                        : `${leader.nickname} has edged into a useful lead on ${leader.points} points, but ${second.nickname} on ${second.points} remains close enough to keep the back-page writers interested, ${randomGloucester}. ${matchAnalysis}${predictionAnalysis}${standardSecondParagraph(`${tieAnalysis}${bottomTableAnalysis}There are still ${remainingMatches} matches to play, which means plenty of room for a nerveless exact score and a leaderboard that suddenly looks very different by Monday morning.`)}${completedTournamentSignoffParagraph}${nextFixtureParagraph}`;
                } else if (gap <= 10) {
                    tip = isCompletedTournamentTips
                        ? `${completedTournamentSection}${completedTournamentSignoffParagraph}`
                        : `${leader.nickname} is beginning to pull clear on ${leader.points} points, ${randomGloucester}. ${second.nickname} trails by ${gap} and needs the sort of revival that usually starts with one brave pick and a bit of scoreboard nerve. ${matchAnalysis}${predictionAnalysis}${standardSecondParagraph(`${tieAnalysis}${bottomTableAnalysis}Still, this competition has not gone to print yet. Remember ${randomWorldCupClassic}; momentum can turn in a hurry when the fixtures get awkward.`)}${completedTournamentSignoffParagraph}${nextFixtureParagraph}`;
                } else {
                    tip = isCompletedTournamentTips
                        ? `${completedTournamentSection}${completedTournamentSignoffParagraph}`
                        : `${leader.nickname} has slapped a hefty headline across the top of the table with ${leader.points} points, ${randomGloucester}. ${second.nickname} is ${gap} back and now needs a comeback worthy of the 1999 French side against the All Blacks. ${matchAnalysis}${predictionAnalysis}${standardSecondParagraph(`${tieAnalysis}${bottomTableAnalysis}It is a sizeable gap, but with ${remainingMatches} matches left there are still up to ${remainingMatches * 11} points available. Stranger final editions have been written, especially when the fixture list starts behaving like ${randomGloucester2}.`)}${completedTournamentSignoffParagraph}${nextFixtureParagraph}`;
                }
            }
            
            container.innerHTML = `
                <div class="trevs-tips-header">
                    <span class="trevs-tips-emoji">🏉</span>
                    <span class="trevs-tips-title">Trev's Tips</span>
                </div>
                <div class="trevs-tips-content">${tip}</div>
            `;
        }
