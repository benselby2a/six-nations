// Global state, usage tracking, escaping/cookie helpers, remembered user
// Classic script (shared global scope); load order is set in index.html.

        // In-memory state (loaded from storage on init)
        let users = {};
        let currentUsername = null;
        let adminUsernames = [];
        let appSettings = { predictionsLocked: false, rulesSavedAt: null, prizeSavedAt: null, activeOverrides: {} };
        let selectedYear = null;
        let availableYears = [];
        let allMatches = [];  // Fixtures for every year; `matches` holds the selected year only
        let activeScoringRules = null;
        let userJokerSelections = {};
        let rulesFormInitialized = false;
        let isGuest = false;
        let editingFixtureId = null;
        let pendingNewMatch = null;   // a fixture being added: only becomes a row once Save is pressed
        let nextMatchScoreId = null;
        let editingPredictionContext = null;
        let adminPredictionUsername = null;
        let usageReportEvents = [];
        let usageReportHideLogins = true;
        const THEME_COOKIE_NAME = 'rugbyPredictorTheme';
        const THEME_STORAGE_KEY = 'rugbyPredictorTheme';
        const COOKIE_FALLBACK_PREFIX = 'rugbyPredictorCookieFallback:';
        const REMEMBERED_USER_KEY = 'rugbyPredictorRememberedUser';
        const SELECTED_YEAR_KEY = 'rugbyPredictorSelectedYear';

        // Loading state
        let isLoading = true;

        function getUsageActor(actorOverride = null) {
            if (actorOverride) return String(actorOverride).trim().toLowerCase();
            if (currentUsername) return String(currentUsername).trim().toLowerCase();
            return isGuest ? 'guest' : 'guest';
        }

        function trackUsage(action, payload = '', actorOverride = null) {
            const normalizedAction = (action || '').trim();
            if (!normalizedAction) return;
            // Guests are read-only: the database only accepts usage events from signed-in people
            if (!currentUsername) return;
            Storage.trackUsageEvent(getUsageActor(actorOverride), normalizedAction, payload);
        }

        function formatUsagePayload(input) {
            if (input === null || input === undefined) return '';
            if (typeof input === 'string') return input;
            try {
                return JSON.stringify(input);
            } catch (error) {
                return String(input);
            }
        }

        // Display names are put into page templates, so markup characters are never allowed in them
        function hasUnsafeDisplayChars(text) {
            return /[<>"]/.test(String(text || ''));
        }

        function cleanDisplayText(text) {
            return String(text || '').replace(/[<>"]/g, '');
        }

        function escapeHtml(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        // Cookie helper functions
        function setCookie(name, value, days = 365) {
            try {
                localStorage.setItem(`${COOKIE_FALLBACK_PREFIX}${name}`, String(value));
            } catch (error) {
                // Ignore storage errors and continue with normal cookie write attempt.
            }

            if (window.location.protocol === 'file:') {
                return;
            }

            const expires = new Date();
            expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
            document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
        }

        function getCookie(name) {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
            }

            try {
                return localStorage.getItem(`${COOKIE_FALLBACK_PREFIX}${name}`);
            } catch (error) {
                return null;
            }
        }

        function deleteCookie(name) {
            try {
                localStorage.removeItem(`${COOKIE_FALLBACK_PREFIX}${name}`);
            } catch (error) {
                // Ignore storage cleanup errors.
            }

            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
        }

        function normalizeRememberedUsername(value) {
            const normalized = (value || '').trim().toLowerCase();
            if (!normalized) return '';
            if (!/^[a-z0-9]+$/.test(normalized)) return '';
            return normalized;
        }

        function setRememberedUsername(username) {
            const normalized = normalizeRememberedUsername(username);
            if (!normalized) return;

            setCookie('rugbyPredictorUser', normalized);
            try {
                localStorage.setItem(REMEMBERED_USER_KEY, normalized);
            } catch (error) {
                // Ignore storage errors.
            }
        }

        function clearRememberedUsername() {
            deleteCookie('rugbyPredictorUser');
            try {
                localStorage.removeItem(REMEMBERED_USER_KEY);
            } catch (error) {
                // Ignore storage cleanup errors.
            }
        }

        function getRememberedUsername() {
            const cookieUsername = normalizeRememberedUsername(getCookie('rugbyPredictorUser'));
            if (cookieUsername) return cookieUsername;

            try {
                const storedUsername = normalizeRememberedUsername(localStorage.getItem(REMEMBERED_USER_KEY));
                if (storedUsername) return storedUsername;
            } catch (error) {
                // Ignore storage errors and return empty string below.
            }

            return '';
        }
