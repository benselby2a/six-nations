// Admin: competitors, invitations, sign-in accounts
// Classic script (shared global scope); load order is set in index.html.

        // Auth accounts (admin only), used to link competitors to sign-in accounts
        let authAccounts = [];
        let authAccountsLoaded = false;
        let authAccountsRequested = false;
        let competitorEmails = {};   // username -> the email they are expected to sign in with (admin only)
        let competitorEmails2 = {};  // username -> an optional second sign-in email

        async function loadAuthAccounts() {
            const { data, error } = await supabaseClient.rpc('admin_list_accounts');
            if (error) {
                console.error('Error loading accounts:', error);
                alert('Could not load accounts: ' + (error.message || 'unknown error'));
                return;
            }
            authAccounts = data || [];
            authAccountsLoaded = true;

            const { data: emailRows, error: emailError } = await supabaseClient.rpc('admin_list_competitor_emails');
            if (emailError) {
                console.error('Error loading competitor emails:', emailError);
            } else {
                competitorEmails = {};
                competitorEmails2 = {};
                (emailRows || []).forEach(row => {
                    if (row.email) competitorEmails[row.username] = row.email;
                    if (row.email2) competitorEmails2[row.username] = row.email2;
                });
            }
        }

        async function refreshCompetitorAccounts() {
            await loadAuthAccounts();
            renderCompetitorManagement();
        }

        function linkedAccountsFor(username) {
            return authAccounts.filter(a => (a.linked_username || '').toLowerCase() === username);
        }

        function renderCompetitorAccountCell(username) {
            const linkedAccounts = linkedAccountsFor(username);
            const safeUsername = username.replace(/'/g, "\\'");
            if (!authAccountsLoaded) return '<span class="profile-hint">Loading accounts...</span>';
            let html = linkedAccounts.map(a => `<div>${escapeHtml(a.email || 'unknown email')}
                    <button type="button" class="btn-small btn-warning" onclick="unlinkCompetitorAccount('${safeUsername}', '${a.auth_user_id}')">Unlink</button></div>`).join('');
            if (linkedAccounts.length >= 2) return html;
            const unlinked = authAccounts.filter(a => !a.linked_username);
            if (linkedAccounts.length === 0 && (competitorEmails[username] || competitorEmails2[username])) {
                html += '<div class="profile-hint" style="margin-bottom: 0.4rem;">Links automatically when they first sign in</div>';
            }
            if (unlinked.length === 0) return `${html}<span class="profile-hint">No unlinked accounts</span>`;
            return `${html}<select id="link-account-${username}" style="font-size: 0.85rem; max-width: 220px;">
                    <option value="">Choose account...</option>
                    ${unlinked.map(a => `<option value="${a.auth_user_id}">${escapeHtml(a.email || a.auth_user_id)}</option>`).join('')}
                </select>
                <div class="competitor-actions"><button class="btn-small btn-success" onclick="linkCompetitorAccount('${safeUsername}')">Link</button></div>`;
        }

        async function linkCompetitorAccount(username) {
            const select = document.getElementById(`link-account-${username}`);
            const accountId = select ? select.value : '';
            if (!accountId) {
                alert('Choose an account to link.');
                return;
            }
            const account = authAccounts.find(a => a.auth_user_id === accountId);
            const displayName = toTitleCase((users[username] && users[username].nickname) || username);
            if (!confirm(`Link ${account ? account.email : 'this account'} to ${displayName}? They will sign in as this competitor.`)) {
                return;
            }
            const { error } = await supabaseClient.rpc('admin_link_competitor', {
                p_username: username,
                p_auth_user_id: accountId
            });
            if (error) {
                alert('Could not link account: ' + (error.message || 'unknown error'));
                return;
            }
            trackUsage('link competitor account', formatUsagePayload({ username, email: account ? account.email : null }));
            await refreshCompetitorAccounts();
        }

        async function unlinkCompetitorAccount(username, accountId) {
            const displayName = toTitleCase((users[username] && users[username].nickname) || username);
            if (!confirm(`Unlink the account from ${displayName}? They will not be able to sign in as this competitor until it is linked again.`)) {
                return;
            }
            const { error } = await supabaseClient.rpc('admin_unlink_account', { p_auth_user_id: accountId });
            if (error) {
                alert('Could not unlink account: ' + (error.message || 'unknown error'));
                return;
            }
            trackUsage('unlink competitor account', formatUsagePayload({ username }));
            await refreshCompetitorAccounts();
        }

        // Render competitor management table
        // What the admin has changed but not saved, and which cards are open, survive a re-render
        // (the screen re-renders itself when the account list loads, after linking, and after saving)
        function captureCompetitorScreenState(container) {
            const open = {};
            container.querySelectorAll('details[id]').forEach(d => { if (d.open) open[d.id] = true; });
            const dirty = {};
            container.querySelectorAll('input[id], select[id]').forEach(el => {
                if (el.type === 'checkbox') {
                    // Saved straight away, so the data is the truth; only the add-competitor form is a draft
                    if (el.id.startsWith('new-')) dirty[el.id] = el.checked;
                } else if (el.tagName === 'SELECT') {
                    const original = Array.from(el.options).findIndex(o => o.defaultSelected);
                    if (el.selectedIndex !== original) dirty[el.id] = el.value;
                } else if (el.value !== el.defaultValue) {
                    dirty[el.id] = el.value;
                }
            });
            return { open, dirty };
        }

        function restoreCompetitorScreenState(container, state) {
            Object.keys(state.open).forEach(id => {
                const d = document.getElementById(id);
                if (d) d.open = true;
            });
            Object.keys(state.dirty).forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                if (el.type === 'checkbox') el.checked = state.dirty[id];
                else el.value = state.dirty[id];
            });
        }

        function renderCompetitorManagement() {
            const container = document.getElementById('competitorManagementContainer');
            const allUsers = Object.keys(users).sort((a, b) => a.localeCompare(b));

            if (!authAccountsRequested) {
                authAccountsRequested = true;
                loadAuthAccounts().then(renderCompetitorManagement);
            }

            const previousState = captureCompetitorScreenState(container);
            const teams = Object.keys(countryFlags);
            const teamOptions = (selected) => `<option value="">None</option>` +
                teams.map(t => `<option value="${t}" ${selected === t ? 'selected' : ''}>${getFlag(t)} ${t}</option>`).join('');

            let html = `
                <div class="competitor-cards">
                    <details class="competitor-card competitor-card-new" id="new-competitor-card">
                        <summary>
                            <span class="cc-title"><span class="cc-name">+ Add a competitor</span></span>
                            <span class="cc-chevron" aria-hidden="true"></span>
                        </summary>
                        <div class="cc-fields">
                            <div class="cc-field cc-wide">
                                <label for="new-email-admin">Email <span class="cc-required">required</span></label>
                                <input type="email" id="new-email-admin" placeholder="The email they will sign in with" autocapitalize="none" autocorrect="off" spellcheck="false">
                                <span class="profile-hint">That is all you need. Nothing is emailed: tell them to open the app and sign in with this email, and they fill in their own name and teams the first time. Their card appears below until they have.</span>
                            </div>
                            <details class="cc-optional cc-wide" id="new-competitor-details">
                                <summary>Add their details now (optional)</summary>
                                <div class="cc-fields">
                                    <span class="profile-hint cc-wide">Enter a display name to create them now with these details. Otherwise leave this empty and they choose their own when they first sign in.</span>
                                    <div class="cc-field">
                                        <label for="new-nickname-admin">Display name</label>
                                        <input type="text" id="new-nickname-admin" placeholder="How they appear on the leaderboard">
                                    </div>
                                    <div class="cc-field">
                                        <label for="new-username-admin">Username</label>
                                        <input type="text" id="new-username-admin" placeholder="Made from the name if empty" autocapitalize="none" autocorrect="off" spellcheck="false">
                                    </div>
                                    <div class="cc-field">
                                        <label for="new-team1-admin">Supported team 1</label>
                                        <select id="new-team1-admin">${teamOptions('')}</select>
                                    </div>
                                    <div class="cc-field">
                                        <label for="new-team2-admin">Supported team 2</label>
                                        <select id="new-team2-admin">${teamOptions('')}</select>
                                    </div>
                                    <label class="cc-toggle"><input type="checkbox" id="new-active-admin" checked><span>Playing in ${selectedYear}</span></label>
                                    <label class="cc-toggle"><input type="checkbox" id="new-admin-admin"><span>Admin</span></label>
                                </div>
                            </details>
                            <div class="cc-actions cc-wide">
                                <button type="button" class="btn-success" onclick="addCompetitor()">Add Competitor</button>
                            </div>
                        </div>
                    </details>
            `;

            allUsers.forEach(username => {
                const user = users[username];
                const isAdmin = adminUsernames.includes(username);
                const isActive = isCompetitorActive(username);
                const safeUsername = username.replace(/'/g, "\\'");
                const userTeams = user.supportedTeams || [];
                const linked = authAccountsLoaded && linkedAccountsFor(username).length > 0;
                const waiting = authAccountsLoaded && !linked && !!(competitorEmails[username] || competitorEmails2[username]);
                const isInvite = !user.nickname;   // invited: no display name until they sign in and fill it in
                const displayName = isInvite
                    ? escapeHtml(competitorEmails[username] || 'Invited')
                    : escapeHtml(toTitleCase(user.nickname || username));
                html += `
                    <details class="competitor-card" id="user-row-${username}">
                        <summary>
                            <span class="cc-title">
                                <span class="cc-name">${displayName}</span>
                                <span class="cc-username">@${username}</span>
                            </span>
                            <span class="cc-chips">
                                ${isAdmin ? '<span class="cc-chip cc-chip-admin">Admin</span>' : ''}
                                ${isInvite
                                    ? `<span class="cc-chip">${linked ? 'Setting up their profile' : 'Invited, not signed in yet'}</span>`
                                    : `<span class="cc-chip ${isActive ? 'cc-chip-on' : 'cc-chip-off'}">${isActive ? `Playing ${selectedYear}` : 'Not playing'}</span>
                                ${linked ? '<span class="cc-chip cc-chip-on">Signed up</span>' : (waiting ? '<span class="cc-chip">Awaiting sign-in</span>' : '')}`}
                            </span>
                            <span class="cc-chevron" aria-hidden="true"></span>
                        </summary>
                        <div class="cc-fields">
                            <div class="cc-field">
                                <label for="edit-username-${username}">Username</label>
                                <input type="text" id="edit-username-${username}" value="${username}" autocapitalize="none" autocorrect="off" spellcheck="false">
                            </div>
                            <div class="cc-field">
                                <label for="edit-nickname-${username}">Display name</label>
                                <input type="text" id="edit-nickname-${username}" value="${escapeHtml(user.nickname || '')}">
                            </div>
                            <div class="cc-field cc-wide">
                                <label for="edit-email-${username}">Sign-in email</label>
                                <input type="email" id="edit-email-${username}" value="${escapeHtml(competitorEmails[username] || '')}" placeholder="The email they will sign in with" autocapitalize="none" autocorrect="off" spellcheck="false">
                                <span class="profile-hint">Changing or clearing this moves their login: the old email stops working.</span>
                            </div>
                            <div class="cc-field cc-wide">
                                <label for="edit-email2-${username}">Second sign-in email (optional)</label>
                                <input type="email" id="edit-email2-${username}" value="${escapeHtml(competitorEmails2[username] || '')}" placeholder="Either email can sign in as this person" autocapitalize="none" autocorrect="off" spellcheck="false">
                            </div>
                            <div class="cc-field">
                                <label for="edit-team1-${username}">Supported team 1</label>
                                <select id="edit-team1-${username}">${teamOptions(userTeams[0])}</select>
                            </div>
                            <div class="cc-field">
                                <label for="edit-team2-${username}">Supported team 2</label>
                                <select id="edit-team2-${username}">${teamOptions(userTeams[1])}</select>
                            </div>
                            <label class="cc-toggle"><input type="checkbox" id="edit-active-${username}" ${isActive ? 'checked' : ''} onchange="toggleCompetitorActive('${safeUsername}', this.checked)"><span>Playing in ${selectedYear}</span></label>
                            <label class="cc-toggle"><input type="checkbox" id="edit-admin-${username}" ${isAdmin ? 'checked' : ''} onchange="toggleUserAdmin('${safeUsername}')"><span>Admin</span></label>
                            <div class="cc-field cc-wide">
                                <span class="cc-label">Sign-in account</span>
                                ${renderCompetitorAccountCell(username)}
                            </div>
                            <div class="cc-actions cc-wide">
                                <button type="button" class="btn-success" onclick="saveUserChanges('${safeUsername}')">Save</button>
                                <button type="button" class="btn-danger" onclick="deleteUser('${safeUsername}')">Delete</button>
                            </div>
                        </div>
                    </details>
                `;
            });

            html += '</div>';
            container.innerHTML = html;
            restoreCompetitorScreenState(container, previousState);
        }

        // Put the add-competitor form back to how it starts (so a re-render does not bring old text back)
        function resetAddCompetitorForm() {
            ['new-email-admin', 'new-nickname-admin', 'new-username-admin'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            ['new-team1-admin', 'new-team2-admin'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.selectedIndex = 0;
            });
            const active = document.getElementById('new-active-admin');
            if (active) active.checked = true;
            const admin = document.getElementById('new-admin-admin');
            if (admin) admin.checked = false;
        }

        // Add someone. Only the email is needed: they fill in their own name and teams the first time they
        // sign in. If a display name is entered under "details", the competitor is created now with those.
        async function addCompetitor() {
            if (!isCurrentUserAdmin()) return;
            const email = (document.getElementById('new-email-admin').value || '').trim().toLowerCase();
            let username = (document.getElementById('new-username-admin').value || '').trim().toLowerCase();
            const nickname = (document.getElementById('new-nickname-admin').value || '').trim();
            const team1 = (document.getElementById('new-team1-admin').value || '').trim();
            const team2 = (document.getElementById('new-team2-admin').value || '').trim();
            const makeAdmin = !!document.getElementById('new-admin-admin').checked;
            const makeActive = !!document.getElementById('new-active-admin').checked;

            if (!email) {
                alert('An email is needed: it is how they sign in.');
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                alert('That email does not look right.');
                return;
            }

            const detailsGiven = !!(username || nickname || team1 || team2 || makeAdmin);
            if (detailsGiven && !nickname) {
                alert('Add a display name to create them now, or clear the optional details and they will choose their own when they first sign in.');
                return;
            }

            // Refuse an email that is already registered, before anything is created
            const { data: taken, error: checkError } = await supabaseClient.rpc('check_login_email', { p_email: email });
            if (checkError) {
                alert('Could not check that email. Please try again.');
                return;
            }
            if (taken === true) {
                alert(`${email} is already registered.`);
                return;
            }

            // Email only: an invitation. They complete their own profile when they first sign in.
            if (!detailsGiven) {
                const { error } = await supabaseClient.rpc('admin_invite_email', { p_email: email });
                if (error) {
                    alert(error.message || 'Could not add that email.');
                    return;
                }
                trackUsage('invite email', formatUsagePayload({ email }));
                resetAddCompetitorForm();
                // The invitation is a new row on the users table: load it and show its card
                users = await Storage.getUsers();
                await loadAuthAccounts();
                renderCompetitorManagement();
                alert(`${email} has been added. They can now sign in with an emailed code and fill in their own details.`);
                return;
            }

            // Details given: create the competitor now
            if (hasUnsafeDisplayChars(nickname)) {
                alert('Display name cannot contain < > or " characters.');
                return;
            }
            const existingNickname = Object.keys(users).find(u =>
                users[u].nickname && users[u].nickname.toLowerCase() === nickname.toLowerCase()
            );
            if (existingNickname) {
                alert('This display name is already taken.');
                return;
            }

            if (username) {
                if (!/^[a-z0-9]+$/.test(username)) {
                    alert('Username can only contain letters and numbers.');
                    return;
                }
                if (users[username]) {
                    alert('This username is already taken.');
                    return;
                }
            } else {
                // A tidy username from the display name, made unique
                const base = nickname.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 26) || 'player';
                username = base;
                for (let n = 2; users[username] || username === 'guest' || adminUsernames.includes(username); n++) {
                    username = base + n;
                }
            }

            const supportedTeams = [team1, team2].filter(Boolean);
            const newUser = {
                nickname,
                predictions: {},
                totalTries: null,
                supportedTeams
            };

            users[username] = newUser;
            await Storage.saveUser(username, newUser);

            if (makeAdmin && !adminUsernames.includes(username)) {
                adminUsernames.push(username);
                await Storage.saveAdminUsernames(adminUsernames);
                updateAdminTabsSubheading();
            }

            if (makeActive) {
                const overrides = { ...(appSettings.activeOverrides || {}), [username]: true };
                if (await Storage.saveActiveOverrides(overrides)) appSettings.activeOverrides = overrides;
            }

            const { error: emailError } = await supabaseClient.rpc('admin_set_competitor_email', { p_username: username, p_email: email });
            if (emailError) {
                alert('The competitor was added, but the email was not saved: ' + (emailError.message || 'unknown error'));
            } else {
                competitorEmails[username] = email;
            }

            alert(`Competitor ${toTitleCase(nickname)} added. They can sign in with ${email}.`);
            resetAddCompetitorForm();
            renderCompetitorManagement();
            updateLeaderboard();
        }

        // Save changes to a user
        async function saveUserChanges(username) {
            const newUsername = document.getElementById(`edit-username-${username}`).value.trim().toLowerCase();
            const nickname = document.getElementById(`edit-nickname-${username}`).value.trim();
            const emailInput = document.getElementById(`edit-email-${username}`);
            const newEmail = emailInput ? emailInput.value.trim().toLowerCase() : null;
            const email2Input = document.getElementById(`edit-email2-${username}`);
            const newEmail2 = email2Input ? email2Input.value.trim().toLowerCase() : null;
            if ((newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) || (newEmail2 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail2))) {
                alert('That sign-in email does not look right.');
                return;
            }

            if (!newUsername) {
                alert('Username is required.');
                return;
            }

            if (!/^[a-z0-9]+$/.test(newUsername)) {
                alert('Username can only contain letters and numbers.');
                return;
            }

            if (!nickname && users[username] && users[username].nickname) {
                alert('Display name is required.');
                return;
            }

            if (hasUnsafeDisplayChars(nickname)) {
                alert('Display name cannot contain < > or " characters.');
                return;
            }

            // Check if new username is taken by another user
            if (newUsername !== username && users[newUsername]) {
                alert('This username is already taken by another user.');
                return;
            }

            // Check if nickname is taken by another user
            const existingUser = nickname && Object.keys(users).find(u =>
                u !== username && users[u].nickname && users[u].nickname.toLowerCase() === nickname.toLowerCase()
            );
            if (existingUser) {
                alert('This display name is already taken by another user.');
                return;
            }

            // Read supported teams from dropdowns
            const team1El = document.getElementById(`edit-team1-${username}`);
            const team2El = document.getElementById(`edit-team2-${username}`);
            const team1 = team1El ? team1El.value : '';
            const team2 = team2El ? team2El.value : '';

            if (newUsername !== username) {
                // Username changed - update DB username, re-key local data, update admin list
                await Storage.renameUser(username, newUsername);

                // Update admin usernames list
                const adminIndex = adminUsernames.indexOf(username);
                if (adminIndex !== -1) {
                    adminUsernames[adminIndex] = newUsername;
                    await Storage.saveAdminUsernames(adminUsernames);
                    updateAdminTabsSubheading();
                }

                // Re-key in local users object
                users[newUsername] = users[username];
                delete users[username];
                if (appSettings.activeOverrides && Object.prototype.hasOwnProperty.call(appSettings.activeOverrides, username)) {
                    appSettings.activeOverrides[newUsername] = appSettings.activeOverrides[username];
                    delete appSettings.activeOverrides[username];
                }

                // Update current session if editing self
                if (currentUsername === username) {
                    currentUsername = newUsername;
                }
            }

            users[newUsername].nickname = nickname || null;
            users[newUsername].supportedTeams = [team1, team2].filter(Boolean);

            await Storage.saveUser(newUsername, users[newUsername]);
            updateAdminTabsSubheading();

            // Keep the registered email in step with the (possibly renamed) competitor
            if (newUsername !== username) {
                if (competitorEmails[username] !== undefined) { competitorEmails[newUsername] = competitorEmails[username]; delete competitorEmails[username]; }
                if (competitorEmails2[username] !== undefined) { competitorEmails2[newUsername] = competitorEmails2[username]; delete competitorEmails2[username]; }
            }
            const emailSlots = [[1, newEmail, competitorEmails], [2, newEmail2, competitorEmails2]];
            let emailsChanged = false;
            for (const [slot, value, map] of emailSlots) {
                if (value === null || value === (map[newUsername] || '')) continue;
                const { error: emailError } = await supabaseClient.rpc('admin_set_competitor_email', { p_username: newUsername, p_email: value, p_slot: slot });
                if (emailError) {
                    alert(`Saved, but the ${slot === 2 ? 'second ' : ''}sign-in email was not: ` + (emailError.message || 'unknown error'));
                } else {
                    if (value) map[newUsername] = value; else delete map[newUsername];
                    emailsChanged = true;
                }
            }
            // Changing an email releases that old sign-in account: reload who is linked
            if (emailsChanged) await loadAuthAccounts();

            alert('User updated successfully.');

            // Update current user display if editing self
            if (newUsername === currentUsername) {
                document.getElementById('currentUser').textContent = toTitleCase(nickname);
            }

            // Re-render to update row IDs and input IDs
            renderCompetitorManagement();
        }

        // Toggle user admin status
        async function toggleUserAdmin(username) {
            const user = users[username];
            if (!user) return;

            const isCurrentlyAdmin = adminUsernames.includes(username);

            if (isCurrentlyAdmin) {
                // Remove from admins
                adminUsernames = adminUsernames.filter(u => u !== username);
            } else {
                // Add to admins
                adminUsernames.push(username);
            }

            await Storage.saveAdminUsernames(adminUsernames);
            updateAdminTabsSubheading();
        }

        // Delete a user
        async function deleteUser(username) {
            if (!username || !users[username]) {
                alert('User not found.');
                return;
            }
            
            if (username === currentUsername) {
                alert('You cannot delete your own account while logged in.');
                return;
            }

            const displayName = toTitleCase(users[username].nickname || username);
            if (!confirm(`Are you sure you want to delete ${displayName}? This cannot be undone.`)) {
                return;
            }

            // Remove from admin list if they were an admin
            adminUsernames = adminUsernames.filter(u => u !== username);
            await Storage.saveAdminUsernames(adminUsernames);
            updateAdminTabsSubheading();

            delete users[username];
            if (appSettings.activeOverrides) delete appSettings.activeOverrides[username];
            await Storage.deleteUser(username);
            renderCompetitorManagement();
            updateLeaderboard();
        }
