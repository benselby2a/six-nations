// Admin: scoring rules and prize fund forms
// Classic script (shared global scope); load order is set in index.html.

        function setRulesFeedback(message, type = 'info') {
            const feedbackEls = [
                document.getElementById('rulesFeedback'),
                document.getElementById('prizeRulesFeedback')
            ].filter(Boolean);
            if (feedbackEls.length === 0) return;

            feedbackEls.forEach(feedback => {
                if (!message) {
                    feedback.classList.add('hidden');
                    feedback.classList.remove('error', 'success', 'info');
                    feedback.textContent = '';
                    return;
                }
                feedback.classList.remove('hidden', 'error', 'success', 'info');
                feedback.classList.add(type);
                feedback.textContent = message;
            });
        }

        function parseRulesIntInput(id, options = {}) {
            const { required = true, fallback = 0 } = options;
            const el = document.getElementById(id);
            if (!el) return required ? null : fallback;
            const raw = String(el.value || '').trim();
            if (!raw) return required ? null : fallback;
            const parsed = Number(raw);
            if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
                return null;
            }
            return parsed;
        }

        function parseRulesDecimalInput(id, options = {}) {
            const { required = true, fallback = 0, maxDecimals = 2 } = options;
            const el = document.getElementById(id);
            if (!el) return required ? null : fallback;
            const raw = String(el.value || '').trim();
            if (!raw) return required ? null : fallback;
            const parsed = Number(raw);
            if (!Number.isFinite(parsed) || parsed < 0) return null;
            const factor = 10 ** maxDecimals;
            return Math.round(parsed * factor) / factor;
        }

        function readRulesFormData() {
            const data = {
                correctResultPoints: parseRulesIntInput('rulesCorrectResultPoints'),
                perfectScoreBonus: parseRulesIntInput('rulesPerfectScoreBonus'),
                drawBonus: parseRulesIntInput('rulesDrawBonus'),
                maxJokersPerUser: parseRulesIntInput('rulesMaxJokersPerUser'),
                entryFeeAmount: parseRulesDecimalInput('rulesEntryFeeAmount'),
                payoutFirstPct: parseRulesDecimalInput('rulesPayoutFirstPct'),
                payoutSecondPct: parseRulesDecimalInput('rulesPayoutSecondPct'),
                payoutThirdPct: parseRulesDecimalInput('rulesPayoutThirdPct'),
                payoutClosestTriesPct: parseRulesDecimalInput('rulesPayoutClosestTriesPct'),
                closeTiers: []
            };

            for (let i = 1; i <= 3; i += 1) {
                const withinEl = document.getElementById(`rulesTier${i}Within`);
                const bonusEl = document.getElementById(`rulesTier${i}Bonus`);
                const withinRaw = withinEl ? String(withinEl.value || '').trim() : '';
                const bonusRaw = bonusEl ? String(bonusEl.value || '').trim() : '';

                if (!withinRaw && !bonusRaw) continue;

                const withinPoints = withinRaw ? Number(withinRaw) : null;
                const bonusPoints = bonusRaw ? Number(bonusRaw) : null;
                data.closeTiers.push({
                    tierOrder: i,
                    withinPoints: Number.isFinite(withinPoints) && withinPoints >= 0 && Number.isInteger(withinPoints) ? withinPoints : null,
                    bonusPoints: Number.isFinite(bonusPoints) && bonusPoints >= 0 && Number.isInteger(bonusPoints) ? bonusPoints : null,
                    _hasWithin: !!withinRaw,
                    _hasBonus: !!bonusRaw
                });
            }

            return data;
        }

        function validateRulesFormData(data) {
            const errors = [];

            if (data.correctResultPoints === null) errors.push('Correct result points must be a whole number 0 or higher.');
            if (data.perfectScoreBonus === null) errors.push('Perfect score bonus must be a whole number 0 or higher.');
            if (data.drawBonus === null) errors.push('Draw bonus must be a whole number 0 or higher.');
            if (data.maxJokersPerUser === null) errors.push('Jokers per user must be a whole number 0 or higher.');
            if (data.entryFeeAmount === null) errors.push('Entry fee must be a number 0 or higher.');
            if (data.payoutFirstPct === null) errors.push('1st place payout % must be a number 0 or higher.');
            if (data.payoutSecondPct === null) errors.push('2nd place payout % must be a number 0 or higher.');
            if (data.payoutThirdPct === null) errors.push('3rd place payout % must be a number 0 or higher.');
            if (data.payoutClosestTriesPct === null) errors.push('Closest tries payout % must be a number 0 or higher.');
            if (data.closeTiers.length === 0) errors.push('At least one close-score tier is required.');

            if (
                data.payoutFirstPct !== null &&
                data.payoutSecondPct !== null &&
                data.payoutThirdPct !== null &&
                data.payoutClosestTriesPct !== null
            ) {
                const payoutTotal = data.payoutFirstPct + data.payoutSecondPct + data.payoutThirdPct + data.payoutClosestTriesPct;
                const allZero = payoutTotal === 0;
                if (!allZero && Math.abs(payoutTotal - 100) > 0.001) {
                    errors.push('Prize payout percentages must total exactly 100 (or all be 0 to disable payouts).');
                }
            }

            data.closeTiers.forEach((tier, index) => {
                const row = index + 1;
                if (!tier._hasWithin || !tier._hasBonus) {
                    errors.push(`Tier ${row} must include both "within points" and "bonus points".`);
                    return;
                }
                if (tier.withinPoints === null || tier.bonusPoints === null) {
                    errors.push(`Tier ${row} values must be whole numbers 0 or higher.`);
                    return;
                }
            });

            return errors;
        }

        function getRulesPayloadFromForm() {
            const raw = readRulesFormData();
            const errors = validateRulesFormData(raw);
            const payload = {
                id: raw.id,
                correctResultPoints: raw.correctResultPoints ?? 0,
                perfectScoreBonus: raw.perfectScoreBonus ?? 0,
                drawBonus: raw.drawBonus ?? 0,
                maxJokersPerUser: raw.maxJokersPerUser ?? 0,
                entryFeeAmount: raw.entryFeeAmount ?? 0,
                payoutFirstPct: raw.payoutFirstPct ?? 0,
                payoutSecondPct: raw.payoutSecondPct ?? 0,
                payoutThirdPct: raw.payoutThirdPct ?? 0,
                payoutClosestTriesPct: raw.payoutClosestTriesPct ?? 0,
                closeTiers: raw.closeTiers
                    .filter(tier => tier.withinPoints !== null && tier.bonusPoints !== null)
                    .map((tier, index) => ({
                        tierOrder: index + 1,
                        withinPoints: tier.withinPoints,
                        bonusPoints: tier.bonusPoints
                    }))
            };
            return { payload, errors };
        }

        function updateRulesPublishState() {
            const { errors } = getRulesPayloadFromForm();
            const isValid = errors.length === 0;
            const saveBtns = [
                document.getElementById('rulesSaveUpdatedBtn'),
                document.getElementById('prizeSaveUpdatedBtn')
            ].filter(Boolean);
            saveBtns.forEach(btn => {
                btn.disabled = !isValid;
            });
        }

        function renderRulesPreview() {
            const output = document.getElementById('rulesPreviewOutput');
            if (!output) return;

            const { payload, errors } = getRulesPayloadFromForm();
            if (errors.length > 0) {
                output.textContent = `Preview unavailable: ${errors[0]}`;
                return;
            }

            const pred1 = parseRulesIntInput('rulesPreviewPred1');
            const pred2 = parseRulesIntInput('rulesPreviewPred2');
            const actual1 = parseRulesIntInput('rulesPreviewActual1');
            const actual2 = parseRulesIntInput('rulesPreviewActual2');
            const joker = !!(document.getElementById('rulesPreviewJoker') && document.getElementById('rulesPreviewJoker').checked);

            if ([pred1, pred2, actual1, actual2].some(value => value === null)) {
                output.textContent = 'Enter whole-number predicted and actual scores to preview points.';
                return;
            }

            const rules = normalizeScoringRules(payload);
            const breakdown = calculateMatchPointsBreakdownWithRules(
                { team1: pred1, team2: pred2 },
                { team1: 'Home', team2: 'Away', actualScore1: actual1, actualScore2: actual2 },
                joker,
                rules
            );

            output.textContent = breakdown.points > 0
                ? `${breakdown.points} pts\n${breakdown.summary}`
                : '0 pts\nNo points awarded for this combination.';
        }

        function populateRulesForm(sourceRules) {
            const source = sourceRules || activeScoringRules || {};
            const normalized = normalizeScoringRules(source);
            const tiersByOrder = {};
            (normalized.closeTiers || []).forEach(tier => {
                tiersByOrder[tier.tierOrder] = tier;
            });

            const correctResultPoints = document.getElementById('rulesCorrectResultPoints');
            const perfectScoreBonus = document.getElementById('rulesPerfectScoreBonus');
            const drawBonus = document.getElementById('rulesDrawBonus');
            const maxJokersPerUser = document.getElementById('rulesMaxJokersPerUser');
            const entryFeeAmount = document.getElementById('rulesEntryFeeAmount');
            const payoutFirstPct = document.getElementById('rulesPayoutFirstPct');
            const payoutSecondPct = document.getElementById('rulesPayoutSecondPct');
            const payoutThirdPct = document.getElementById('rulesPayoutThirdPct');
            const payoutClosestTriesPct = document.getElementById('rulesPayoutClosestTriesPct');

            if (correctResultPoints) correctResultPoints.value = normalized.correctResultPoints;
            if (perfectScoreBonus) perfectScoreBonus.value = normalized.perfectScoreBonus;
            if (drawBonus) drawBonus.value = normalized.drawBonus;
            if (maxJokersPerUser) maxJokersPerUser.value = normalized.maxJokersPerUser;
            if (entryFeeAmount) entryFeeAmount.value = normalized.entryFeeAmount;
            if (payoutFirstPct) payoutFirstPct.value = normalized.payoutFirstPct;
            if (payoutSecondPct) payoutSecondPct.value = normalized.payoutSecondPct;
            if (payoutThirdPct) payoutThirdPct.value = normalized.payoutThirdPct;
            if (payoutClosestTriesPct) payoutClosestTriesPct.value = normalized.payoutClosestTriesPct;

            for (let i = 1; i <= 3; i += 1) {
                const withinInput = document.getElementById(`rulesTier${i}Within`);
                const bonusInput = document.getElementById(`rulesTier${i}Bonus`);
                const tier = tiersByOrder[i];
                if (withinInput) withinInput.value = tier ? tier.withinPoints : '';
                if (bonusInput) bonusInput.value = tier ? tier.bonusPoints : '';
            }
        }

        function initializeRulesTabBindings() {
            if (rulesFormInitialized) return;
            const ids = [
                'rulesCorrectResultPoints',
                'rulesPerfectScoreBonus',
                'rulesDrawBonus',
                'rulesMaxJokersPerUser',
                'rulesEntryFeeAmount',
                'rulesPayoutFirstPct',
                'rulesPayoutSecondPct',
                'rulesPayoutThirdPct',
                'rulesPayoutClosestTriesPct',
                'rulesTier1Within',
                'rulesTier1Bonus',
                'rulesTier2Within',
                'rulesTier2Bonus',
                'rulesTier3Within',
                'rulesTier3Bonus',
                'rulesPreviewPred1',
                'rulesPreviewPred2',
                'rulesPreviewActual1',
                'rulesPreviewActual2',
                'rulesPreviewJoker'
            ];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const evt = el.type === 'checkbox' ? 'change' : 'input';
                el.addEventListener(evt, () => {
                    setRulesFeedback('');
                    updateRulesPublishState();
                    renderRulesPreview();
                });
            });
            rulesFormInitialized = true;
        }

        function renderRulesTab() {
            if (!isCurrentUserAdmin()) return;
            initializeRulesTabBindings();
            populateRulesForm(activeScoringRules);
            updateRulesPublishState();
            renderRulesPreview();
        }

        function renderPrizeFundTab() {
            if (!isCurrentUserAdmin()) return;
            initializeRulesTabBindings();
            populateRulesForm(activeScoringRules);
            updateRulesPublishState();
        }

        async function saveUpdatedRules(kind = null) {
            if (!isCurrentUserAdmin()) return;
            const { payload, errors } = getRulesPayloadFromForm();
            if (errors.length > 0) {
                setRulesFeedback(errors[0], 'error');
                updateRulesPublishState();
                return;
            }

            const saveBtns = [
                document.getElementById('rulesSaveUpdatedBtn'),
                document.getElementById('prizeSaveUpdatedBtn')
            ].filter(Boolean);
            const originalTexts = new Map();
            saveBtns.forEach(btn => {
                originalTexts.set(btn, btn.textContent);
                btn.disabled = true;
                btn.textContent = 'Saving...';
            });

            try {
                const savedId = await Storage.saveScoringRulesDraft(payload);
                if (!savedId) {
                    setRulesFeedback('Failed to save rules.', 'error');
                    return;
                }

                activeScoringRules = await Storage.getActiveScoringRules();
                if (kind === 'rules' || kind === 'prize') {
                    const savedAt = await Storage.markSettingsSaved(kind);
                    if (savedAt) appSettings[`${kind}SavedAt`] = savedAt;
                }
                populateRulesForm(activeScoringRules);
                setRulesFeedback('Rules saved successfully.', 'success');
                renderRulesPreview();
                renderReadinessChecklist();
            } catch (error) {
                console.error('Error saving rules:', error);
                setRulesFeedback('Error while saving rules.', 'error');
            } finally {
                saveBtns.forEach(btn => {
                    btn.textContent = originalTexts.get(btn) || 'Save Updated Rules';
                });
                updateRulesPublishState();
            }
        }

        async function revertRulesToSaved() {
            if (!isCurrentUserAdmin()) return;
            activeScoringRules = await Storage.getActiveScoringRules();
            populateRulesForm(activeScoringRules);
            setRulesFeedback('Form reset to saved rules.', 'info');
            updateRulesPublishState();
            renderRulesPreview();
        }
