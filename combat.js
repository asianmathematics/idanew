import { DexSoldier } from './unit/dexSoldier.js';
import { FourArcher } from './unit/fourArcher.js';
import { Mannequin } from './unit/mannequin.js';
import { Silhouette } from './unit/silhouette.js';
/*import { enemy } from './unit/enemy.js';
import { mysticEnemy } from './unit/mysticEnemy.js';
import { technoEnemy } from './unit/technoEnemy.js';
import { magitechEnemy } from './unit/magitechEnemy.js';
import { ArtificialSolider } from './unit/artificialSolider.js';
import { ChaosAgent } from './unit/chaosAgent.js';
import { CouncilMagician } from './unit/councilMagician.js';
import { CouncilScientist } from './unit/councilScientist.js';
import { Dreamer } from './unit/dreamer.js';
import { Experiment } from './unit/experiment.js';
import { Reject } from './unit/reject.js';
import { Revolutionary } from './unit/revolutionary.js';*/
import { Modifier, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, unitFilter, showMessage, attack, resistDebuff, resetStat, regenerateResources, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, modifiers, currentUnit, currentAction, eventState, resourceChange } from './combatDictionary.js';
import { Unit, createUnit, cloneUnit, allUnits } from './unit/unit.js';

let turnCounter = 1;
let currentTurn = 0;
let wave = 1;
const availableUnits = [DexSoldier, FourArcher, Mannequin, Silhouette];
let selectedUnits = [];
window.combatSpeedMultiplier = 1;
const getDelay = (ms) => ms / window.combatSpeedMultiplier;

function initSpeedControls() {
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.speed-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = '#333';
                b.style.borderColor = '#555';
            });
            btn.classList.add('active');
            btn.style.background = '#060';
            btn.style.borderColor = '#0a0';
            window.combatSpeedMultiplier = parseFloat(btn.dataset.speed);
        });
    });
}

// Import squad selection functions
import { startCombat as startSquadSelect } from './squadselect.js';

// ============================================
// SQUAD SELECTION (Pre-battle setup)
// ============================================

export function startCombat() { startSquadSelect() }

// ============================================
// BATTLE DISPLAY (Grid-based UI)
// ============================================

function updateBattleDisplay() {
    updateModifiers();
    updateInspectorUnits();
    
    // Clear all zones
    const playerBacklineRow = document.getElementById('player-backline-row');
    const frontlineRow = document.getElementById('frontline-row');
    const enemyBacklineRow = document.getElementById('enemy-backline-row');
    
    if (playerBacklineRow) playerBacklineRow.innerHTML = '';
    if (frontlineRow) frontlineRow.innerHTML = '';
    if (enemyBacklineRow) enemyBacklineRow.innerHTML = '';
    
    // Sort units into zones
    const playerBackline = allUnits.filter(u => u.team === 'player' && u.position === 'back' && u.hp > 0);
    const playerFrontline = allUnits.filter(u => u.team === 'player' && u.position === 'front' && u.hp > 0);
    const enemyFrontline = allUnits.filter(u => u.team === 'enemy' && u.position === 'front' && u.hp > 0);
    const enemyBackline = allUnits.filter(u => u.team === 'enemy' && u.position === 'back' && u.hp > 0);
    
    // Add defeated units to their respective zones
    const playerBacklineDefeated = allUnits.filter(u => u.team === 'player' && u.position === 'back' && u.hp <= 0);
    const playerFrontlineDefeated = allUnits.filter(u => u.team === 'player' && u.position === 'front' && u.hp <= 0);
    const enemyFrontlineDefeated = allUnits.filter(u => u.team === 'enemy' && u.position === 'front' && u.hp <= 0);
    const enemyBacklineDefeated = allUnits.filter(u => u.team === 'enemy' && u.position === 'back' && u.hp <= 0);
    
    // Render to zones
    if (playerBacklineRow) {
        playerBackline.forEach(unit => playerBacklineRow.appendChild(renderUnitCard(unit)));
        playerBacklineDefeated.forEach(unit => playerBacklineRow.appendChild(renderUnitCard(unit)));
    }
    
    if (frontlineRow) {
        // Mixed frontline - players on left, enemies on right
        playerFrontline.forEach(unit => frontlineRow.appendChild(renderUnitCard(unit, false, true)));
        enemyFrontline.forEach(unit => frontlineRow.appendChild(renderUnitCard(unit, true, true)));
        playerFrontlineDefeated.forEach(unit => frontlineRow.appendChild(renderUnitCard(unit, false, true)));
        enemyFrontlineDefeated.forEach(unit => frontlineRow.appendChild(renderUnitCard(unit, true, true)));
    }
    
    if (enemyBacklineRow) {
        enemyBackline.forEach(unit => enemyBacklineRow.appendChild(renderUnitCard(unit, true)));
        enemyBacklineDefeated.forEach(unit => enemyBacklineRow.appendChild(renderUnitCard(unit, true)));
    }
}

function renderUnitCard(unit, isEnemy = false, inFrontline = false) {
    const card = document.createElement('div');
    const isDefeated = unit.hp <= 0;
    const isCurrentTurn = currentUnit && unit.name === currentUnit.name;
    const isStunned = unit.stun;
    const isSpecialReady = unit.specialReady && !isDefeated;
    
    card.className = `unit ${unit.team === 'player' ? 'player-unit' : 'enemy-unit'} ${unit.position === 'back' ? 'back' : ''} ${isDefeated ? 'defeated' : ''} ${isCurrentTurn ? 'current-turn' : ''} ${isStunned ? 'stunned' : ''} ${isSpecialReady ? 'special-ready' : ''}`;
    
    let indicators = '';
    if (isStunned) indicators += '<div class="stun-indicator">STUNNED</div>';
    if (isCurrentTurn) indicators += '<div class="turn-indicator">▶</div>';
    
    card.innerHTML = `
        ${indicators}
        <div class="unit-name">${unit.name}</div>
        ${renderUnitStats(unit, isEnemy)}
    `;
    
    return card;
}

function renderUnitStats(unit, isEnemy = false) {
    if (unit.hp <= 0) return `<div style="text-align: center; color: #ff0055; font-style: italic; padding: 10px 0;">DEFEATED</div>`;
    
    const timerProgress = Math.max(0, Math.min(100, 100 - (unit.timer / 10)));
    const hpPercentage = Math.max(0, Math.min(100, (unit.hp / unit.base.hp) * 100));
    const staminaPercentage = Math.max(0, Math.min(100, (unit.stamina / unit.base.stamina) * 100));
    
    const hpLabel = isEnemy ? 'HP' : `HP: ${Math.max(0, unit.hp)}/${unit.base.hp}`;
    const staminaLabel = isEnemy ? 'Stamina' : `Stamina: ${Math.floor(unit.stamina)}/${unit.base.stamina}`;
    
    let stats = `
        <div class='stat-row'>
            <div class='stat-label'>${hpLabel}</div>
            <div class='stat-bar-container'>
                <div class='stat-bar hp-bar' style='width: ${hpPercentage}%'></div>
            </div>
        </div>
        <div class='stat-row'>
            <div class='stat-label'>${staminaLabel}</div>
            <div class='stat-bar-container'>
                <div class='stat-bar stamina-bar' style='width: ${staminaPercentage}%'></div>
            </div>
        </div>
    `;
    
    if (unit.base.mana) {
        const manaPercentage = Math.max(0, Math.min(100, (unit.mana / unit.base.mana) * 100));
        const manaLabel = isEnemy ? 'Mana' : `Mana: ${Math.floor(unit.mana)}/${unit.base.mana}`;
        stats += `
            <div class='stat-row'>
                <div class='stat-label'>${manaLabel}</div>
                <div class='stat-bar-container'>
                    <div class='stat-bar mana-bar' style='width: ${manaPercentage}%'></div>
                </div>
            </div>
        `;
    }
    
    if (unit.base.energy) {
        const energyPercentage = Math.max(0, Math.min(100, (unit.energy / unit.base.energy) * 100));
        const energyLabel = isEnemy ? 'Energy' : `Energy: ${Math.floor(unit.energy)}/${unit.base.energy}`;
        stats += `
            <div class='stat-row'>
                <div class='stat-label'>${energyLabel}</div>
                <div class='stat-bar-container'>
                    <div class='stat-bar energy-bar' style='width: ${energyPercentage}%'></div>
                </div>
            </div>
        `;
    }
    
    const readyText = unit.timer <= 0 ? 'Ready!' : 'Charging...';
    stats += `
        <div class='stat-row'>
            <div class='stat-label'>${readyText}</div>
            <div class='stat-bar-container'>
                <div class='stat-bar timer-bar' style='width: ${timerProgress}%'></div>
            </div>
        </div>
    `;
    
    return stats;
}

// ============================================
// UNIT INSPECTOR (Tabbed UI)
// ============================================

function updateInspectorUnits() {
    const inspectorList = document.getElementById('inspector-unit-list');
    if (!inspectorList) return;
    const playerUnits = allUnits.filter(u => u.team === 'player');
    if (playerUnits.length === 0) {
        inspectorList.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">No units in battle</p>';
        return;
    }
    
    inspectorList.innerHTML = '';
    
    playerUnits.forEach(unit => {
        const card = document.createElement('div');
        card.className = 'inspector-unit-card';
        card.dataset.unitName = unit.name;
        if (unit.isExpanded) card.classList.add('expanded');
        
        const isDefeated = unit.hp <= 0;
        const specialStatus = unit.specialReady ? 'READY' : (isDefeated ? 'DEFEATED' : 'Charging...');
        const statusClass = unit.specialReady ? 'ready' : '';
        card.innerHTML = `
            <div class="inspector-unit-header">
                <span class="inspector-unit-name">${unit.name}</span>
                <span class="inspector-unit-status ${statusClass}">${specialStatus}</span>
            </div>
            <div class="inspector-mini-bars">
                <div>HP: ${Math.round((unit.hp / unit.base.hp) * 100)}%</div>
                <div>STA: ${Math.round((unit.stamina / unit.base.stamina) * 100)}%</div>
                <div>Timer: ${Math.max(0, Math.round(100 - (unit.timer / 10)))}%</div>
                <div>Mode: ${unit.autoBehavior || 'basic'}</div>
            </div>
            <div class="inspector-unit-details">
                ${renderUnitDetails(unit)}
            </div>
        `;
        
        card.addEventListener('click', () => {
            unit.isExpanded = !unit.isExpanded;
            card.classList.toggle('expanded');
        });
        
        inspectorList.appendChild(card);
    });
}

function renderUnitDetails(unit) {
    let html = `
        <div style="margin-top:10px; padding:10px; background:#0a0a0a; border:1px solid #333;">
        <div style="font-size:12px; color:#888; margin-bottom:5px;">CURRENT STATS</div>
        <div style="font-size:11px; color:#00ff88; line-height: 1.5;">
            <span style="white-space: nowrap;">Attack: ${Math.round(unit.attack)}</span> | <span style="white-space: nowrap;">Defense: ${Math.round(unit.defense)}</span> | <span style="white-space: nowrap;">Accuracy: ${Math.round(unit.accuracy)}</span> | 
            <span style="white-space: nowrap;">Evasion: ${Math.round(unit.evasion)}</span> | <span style="white-space: nowrap;">Focus: ${Math.round(unit.focus)}</span> | <span style="white-space: nowrap;">Resist: ${Math.round(unit.resist)}</span> | 
            <span style="white-space: nowrap;">Speed: ${Math.round(unit.speed)}</span> | <span style="white-space: nowrap;">Presence: ${Math.round(unit.presence)}</span> | <span style="white-space: nowrap;">Heal Factor: ${Math.round(unit.healFactor)}</span> | 
            <span style="white-space: nowrap;">Stamina Regen: ${Math.round(unit.staminaRegen)}</span>${unit.mana ? ` | <span style="white-space: nowrap;">Mana Regen: ${Math.round(unit.manaRegen)}</span>` : ''}${unit.energy ? ` | <span style="white-space: nowrap;">Energy Regen: ${Math.round(unit.energyRegen)}</span>` : ''}
        </div>
    </div>
    `;
    
    // Doctrine Toggle
    html += `
        <div style="margin-top:10px;">
            <div style="font-size:12px; color:#888; margin-bottom:5px;">AUTO-BEHAVIOR</div>
            <div class="doctrine-toggle">
                ${ unit.skills.basic ? `<button class="doctrine-btn ${unit.autoBehavior === 'basic' ? 'active' : ''}" data-behavior="basic" data-unit="${unit.name}">Basic</button>` : ''}
                ${ unit.skills.secondary ?`<button class="doctrine-btn ${unit.autoBehavior === 'secondary' ? 'active' : ''}" data-behavior="secondary" data-unit="${unit.name}">Secondary</button>` : ''}
                ${ unit.skills.basic && unit.skills.secondary ?`<button class="doctrine-btn ${unit.autoBehavior === 'both' ? 'active' : ''}" data-behavior="both" data-unit="${unit.name}">Both</button>` : ''}
                ${`<button class="doctrine-btn ${unit.autoBehavior === 'none' ? 'active' : ''}" data-behavior="none" data-unit="${unit.name}">None</button>`}
            </div>
        </div>
    `;
    
    // Special Activation Button
    if (unit.skills?.special && unit.hp > 0) {
        const canActivate = unit.specialReady && unit.stamina >= (unit.skills.special.cost?.stamina || 0) && (unit.mana || 0) >= (unit.skills.special.cost?.mana || 0) && (unit.energy || 0) >= (unit.skills.special.cost?.energy || 0);
        html += `
            <button class="activate-special-btn" data-unit="${unit.name}" ${!canActivate ? 'disabled' : ''}>
                ⚡ Activate Special: ${unit.skills.special.name}
            </button>
        `;
    }
    
    // Skills List
    html += `<div style="margin-top:10px; font-size:11px; color:#888;">EQUIPPED SKILLS:</div>`;
    if (unit.skills) { Object.values(unit.skills).forEach(skill => { html += `<div style="font-size:11px; color:#00aaff; margin:3px 0;">• ${skill.name}</div>` }) }
    else html += `<div style="font-size:11px; color:#666;">No skills equipped</div>`;
    return html;
}

// ============================================
// MODIFIERS TAB
// ============================================

function updateModifiers() {
    const modifiersContent = document.getElementById('modifiers-content');
    if (!modifiersContent) return;
    let modDisplay = `<h3 style="border-bottom:2px solid #ff0055; padding-bottom:5px; margin-bottom:10px;">Active Modifiers</h3>`;
    if (modifiers.length === 0) modDisplay += `<p style="color:#888;">No active modifiers</p>`;
    else {
        modDisplay += `<ul class='modifier-list'>`;
        for (const modifier of modifiers) {
            const isCancelled = modifier.vars.cancel > 0;
            let targetDisplay = '';
            let fullTargets = '';
            if (modifier.vars?.target) {
                targetDisplay = modifier.vars.target.name;
                fullTargets = modifier.vars.target.name;
            } else if (modifier.vars?.targets?.length) {
                const targetNames = modifier.vars.targets.map(u => u.name);
                fullTargets = targetNames.join(', ');
                if (targetNames.length > 5) targetDisplay = `<span class="modifier-targets truncated" data-full-targets="${fullTargets}">${targetNames.slice(0, 4).join(', ')}, +${targetNames.length - 4} more</span>`;
                else targetDisplay = fullTargets;
            }
            modDisplay += `
                <li class="modifier-item ${isCancelled ? 'cancelled' : ''}">
                    <span class="modifier-caster">${modifier.vars.caster?.name || 'System'}'s</span>
                    <span class="modifier-name" data-tooltip="${modifier.description}">${modifier.name}.</span>
                    <div class="modifier-targets">Targets: ${targetDisplay}</div>
                    <div class="modifier-duration">${modifier.vars.duration || 'indefinite'} turn(s) left</div>
                    ${isCancelled ? '<div class="cancelled-indicator">(CANCELLED)</div>' : ''}
                </li>
            `;
        }
        modDisplay += `</ul>`;
    }
    modifiersContent.innerHTML = modDisplay;
}

// ============================================
// TAB SWITCHING
// ============================================

function initTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update button states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            // Update content visibility
            document.querySelectorAll('.tab-content').forEach(content => { content.classList.remove('active') });
            document.getElementById(`tab-${button.dataset.tab}`).classList.add('active');
        });
    });
}

// ============================================
// DOCTRINE TOGGLE & SPECIAL ACTIVATION
// ============================================

function initInspectorControls() {
    document.addEventListener('click', (e) => {
        // Doctrine toggle
        if (e.target.classList.contains('doctrine-btn')) {
            const unit = allUnits.find(u => u.name === e.target.dataset.unit);
            if (unit) {
                unit.autoBehavior = e.target.dataset.behavior;
                logAction(`${unit.name} doctrine set to: ${e.target.dataset.behavior.toUpperCase()}`, 'info');
                updateInspectorUnits();
            }
        }
        if (e.target.classList.contains('activate-special-btn')) {
            const unit = allUnits.find(u => u.name === e.target.dataset.unit);
            if (unit?.specialReady) unit.pendingSpecial = true;
        }
    });
}

// ============================================
// AUTO-BATTLE COMBAT TICK
// ============================================

export async function combatTick() {
    if (currentUnit) currentUnit.timer += 1000;
    setUnit(null);
    updateBattleDisplay();
    await sleep(500);
    if (frontTest()) return;
    if (currentTurn === -1) currentTurn = 0;
    let turn;
    let isSpecialInterrupt = false;
    // 1. CHECK FOR PENDING SPECIAL INTERRUPT
    const specialUnit = allUnits.find(u => u.hp > 0 && u.pendingSpecial);
    if (specialUnit) {
        turn = specialUnit;
        specialUnit.pendingSpecial = false;
        isSpecialInterrupt = true;
    } else {
        // 2. NORMAL TURN SEARCH
        while (turn == undefined) {
            for (let i = 0; i < allUnits.length; i++) {
                const unit = allUnits[(currentTurn + i) % allUnits.length];
                if (unit.hp <= 0) continue;
                unit.timer -= unit.speed;
                if (unit.timer <= 0) {
                    turn = unit;
                    currentTurn = (currentTurn + i) % allUnits.length;
                    break;
                }
                await sleep(0);
            }
            updateBattleDisplay();
        }
    }
    if (eventState.turnStart.length && !isSpecialInterrupt) handleEvent('turnStart', { unit: turn });
    if (!turn.stun) {
        setUnit(turn);
        regenerateResources(turn);
        updateBattleDisplay();
        
        if (turn.team === 'player') {
            if (isSpecialInterrupt) {
                // FORCE SPECIAL ACTION
                const specialSkill = turn.skills.special;
                if (specialSkill && typeof specialSkill.code === 'function') {
                    executeSpecialAction(turn, specialSkill);
                } else {
                    // Fallback if no special skill is equipped
                    logAction("Can't find special action!", "error");
                    if (eventState.turnEnd.length) handleEvent('turnEnd', { unit: turn });
                    setTimeout(combatTick, getDelay(500));
                }
            } else {
                logAction(`<strong>Turn ${turnCounter++}: ${turn.name}'s turn</strong>`, 'turn');
                const behavior = turn.autoBehavior || (turn.skills.basic ? 'basic' : turn.skills.secondary ? 'secondary' : 'none');
                if (behavior === 'none') {
                    if (eventState.actionStart.length) handleEvent('actionStart', {unit, action: 'skip'});
                    logAction(`${turn.name} is resting!`, 'info');
                    regenerateResources(turn);
                    // FIX: Advance the turn even if resting
                    if (eventState.turnEnd.length) handleEvent('turnEnd', { unit: turn });
                    turn.timer += 1000;
                    setTimeout(combatTick, getDelay(500));
                } else if (behavior === 'both') {
                    executeBoth(turn);
                } else {
                    executeAutoAction(turn, behavior);
                }
            }
        }
        
        if (turn.team === 'enemy') {
            logAction(`<strong>Turn ${turnCounter++}: ${turn.name}'s turn</strong>`, 'turn');
            enemyTurn(turn);
        }
    } else {
        logAction(`${turn.name}'s turn was skipped due to being stunned!`, 'miss');
        if (eventState.turnEnd.length) {
            handleEvent('turnEnd', { unit: turn });
        }
        turn.timer += 1000;
        setTimeout(combatTick, getDelay(500));
    }
}

function executeAutoAction(unit, action) {
    if (eventState.actionStart.length) handleEvent('actionStart', {unit, action});
    if (!unit.skills[action].cost || resourceChange(unit, unit.skills[action].cost)) {
        if (unit.skills[action].properties.includes('physical')) unit.previousAction[0] = true;
        if (unit.skills[action].properties.includes('mystic')) unit.previousAction[1] = true;
        if (unit.skills[action].properties.includes('techno')) unit.previousAction[2] = true;
        currentAction.push(unit.skills[action]);
        unit.skills[action].code.call(unit);
        currentAction.pop();
    }
    unit.specialReady = true;
    if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
    setTimeout(combatTick, getDelay(500));
}

function executeBoth(unit) {
    if (eventState.actionStart.length) handleEvent('actionStart', {unit, action: 'both'});
    const cost = {};
    for (const res of ['stamina', 'mana', 'energy']) {
        let attrib;
        switch (res) {
            case 'stamina':
                attrib = 'physical'
                break;
            case 'mana':
                attrib = 'mystic'
                break;
            case 'energy':
                attrib = 'techno'
        }
        let count = unit.skills.basic?.properties?.includes(attrib) + unit.skills.secondary?.properties?.includes(attrib);
        if (count) cost[res] = count * 10;
        count = ((unit.skills.basic?.cost?.[res] || 0) + (unit.skills.secondary?.cost?.[res] || 0));
        if (count) cost[res] = (cost[res] || 0) + count;
    }
    if (JSON.stringify(cost) === '{}' || resourceChange(unit, cost)) {
        if (unit.skills.basic?.properties?.includes('physical') || unit.skills.secondary?.properties?.includes('physical')) unit.previousAction[0] = true;
        if (unit.skills.basic?.properties?.includes('mystic') || unit.skills.secondary?.properties?.includes('mystic')) unit.previousAction[1] = true;
        if (unit.skills.basic?.properties?.includes('techno') || unit.skills.secondary?.properties?.includes('techno')) unit.previousAction[2] = true;
        currentAction.push(unit.skills.basic);
        unit.skills.basic.code.call(unit);
        currentAction.pop();
        currentAction.push(unit.skills.secondary);
        unit.skills.secondary.code.call(unit);
        currentAction.pop();
    }
    if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
    setTimeout(combatTick, getDelay(500));
}

function executeSpecialAction(unit, specialSkill) {
    if (eventState.actionStart.length) handleEvent('actionStart', {unit, action: 'special'});
    if (specialSkill.target) specialSkill.target.call(unit);
    else {
        if (specialSkill.cost && !resourceChange(unit, specialSkill.cost)) return showMessage(`${unit.name}'s special was canceled!`, 'error', 'validation-message');
        logAction(`<strong>${unit.name}'s turn$' (Special Interrupt!)</strong>`, 'turn');
        if (eventState.turnStart.length) handleEvent('turnStart', { unit });
        currentAction.push(specialSkill);
        specialSkill.code.call(unit);
        currentAction.pop();
        if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
    }
    setTimeout(combatTick, getDelay(2000));
}

// ============================================
// WAVE MANAGEMENT
// ============================================

export function advanceWave(x = 0) {
    if (x) wave = x;
    let turnId = allUnits[currentTurn]?.name;
    if (wave < 3) {
        allUnits.splice(0, allUnits.length, ...allUnits.filter(unit => unit.team === 'player'));
        for (const mod of modifiers) if (!allUnits.includes(mod.vars.caster)) removeModifier(mod);
    }
    let i = allUnits.length;
    switch (wave) {
        case 2:
            for (const e of waveCalc(unitFilter('player', ''), 1.5)) assignEnemySkills(createUnit(e, 'enemy'), e);
            break;
        case 1:
            for (const e of waveCalc(unitFilter('player', ''), 1)) assignEnemySkills(createUnit(e, 'enemy'), e);
            break;
        default:
            return true;
    }
    currentTurn = allUnits.findIndex(unit => unit.name === turnId);
    logAction(`<strong>Wave ${++wave}!</strong>`, 'turn');
    if (eventState.waveChange.length) handleEvent('waveChange', { wave });
    updateBattleDisplay();
}

function waveCalc(units, mult) {
    const total = units.filter(s => !s.custom?.summoner).reduce((sum, u) => sum + (2.25 ** (+u.description[0] - 1)), 0) * mult;
    let enemyPoints;
    /*if (total >= 100) {
        enemyPoints = new Map([
            [Dreamer, 729/64], [mysticEnemy, 729/64], [technoEnemy, 729/64],
            [ChaosAgent, 729/64], [magitechEnemy, 6561/256]
        ]);
    } else {
        enemyPoints = new Map([
            [Experiment, 9/4], [Reject, 9/4], [CouncilMagician, 81/16],
            [CouncilScientist, 81/16], [Revolutionary, 81/16], [enemy, 81/16],
            [ArtificialSolider, 81/16], [Dreamer, 729/64], [mysticEnemy, 729/64],
            [technoEnemy, 729/64], [ChaosAgent, 729/64], [magitechEnemy, 6561/256]
        ]);
        if (!units.some(u => +u.description[0] === 5) && wave < 3) {
            enemyPoints.delete(magitechEnemy);
        }
        if (total >= 60) {
            enemyPoints.delete(Experiment);
            enemyPoints.delete(Reject);
        }
    }*/
   enemyPoints = new Map([
        [DexSoldier, 81/16], [FourArcher, 81/16], [Mannequin, 81/16],
        [Silhouette, 81/16]
    ]);
    let enemies = [];
    let points = 0;
    //const front = [Experiment, Reject, enemy, ArtificialSolider, mysticEnemy, magitechEnemy].filter(e => enemyPoints.has(e));
    const front = [DexSoldier, Mannequin, Silhouette].filter(e => enemyPoints.has(e));
    while (points < total) {
        const enem = points === 0 ? front[Math.floor(Math.random() * front.length)] : Array.from(enemyPoints.keys())[Math.floor(Math.random() * enemyPoints.size)];
        if (points + enemyPoints.get(enem) <= total || (Math.abs(total - points - enemyPoints.get(enem)) < Math.abs(total - points))) {
            enemies.push(enem);
            points += enemyPoints.get(enem);
        } else break;
    }
    return enemies;
}

function assignEnemySkills(newUnit, template) {
    newUnit.skills = {};
    const categories = ['special', 'basic', 'secondary', 'passive', 'augment'];
    // Helper function to generate a loadout with mulligan logic for unique names
    const getLoadoutForPosition = (pos) => {
        // Fallback to generic defaultSkills if position-specific ones don't exist
        const defaultLoadout = (pos === 'front' ? template.frontDefaultSkills : template.backDefaultSkills) || template.defaultSkills;
        // Attempt to build a full, unique loadout
        for (let attempt = 0; attempt < 5; attempt++) {
            const loadout = {};
            const usedNames = new Set();
            let isFullLoadout = true;
            for (const category of categories) {
                const availableSkills = template.skills[category];
                if (!availableSkills) continue; // Skip if category doesn't exist on the template
                const skillsArray = Array.isArray(availableSkills) ? availableSkills : [availableSkills];
                // Filter by position and unique name
                const validSkills = skillsArray.filter(skill => {
                    const reqPos = skill.cost?.position;
                    return (!reqPos || reqPos === pos) && !usedNames.has(skill.name);
                });
                let selectedSkill = null;
                // 50% Chance to try the Default Skill first
                if (Math.random() < 0.5 && defaultLoadout) {
                    const defaultDef = defaultLoadout.find(def => def.category === category);
                    if (defaultDef) {
                        const defSkill = skillsArray.find(s => s.name === defaultDef.name);
                        if (defSkill && !usedNames.has(defSkill.name)) {
                            const reqPos = defSkill.cost?.position;
                            if (!reqPos || reqPos === pos) selectedSkill = defSkill;
                        }
                    }
                }
                // Fallback to Random if default wasn't picked
                if (!selectedSkill && validSkills.length > 0) selectedSkill = validSkills[Math.floor(Math.random() * validSkills.length)];
                if (selectedSkill) {
                    loadout[category] = selectedSkill;
                    usedNames.add(selectedSkill.name);
                } else isFullLoadout = false;
            }
            // If we successfully filled all existing categories with unique skills, return it
            if (isFullLoadout) return loadout;
        }
        // Final Fallback: If mulligans failed, allow empty slots to strictly prevent duplicates
        const fallbackLoadout = {};
        const fallbackUsedNames = new Set();
        for (const category of categories) {
            const availableSkills = template.skills[category];
            if (!availableSkills) continue;
            const validSkills = availableSkills.filter(skill => {
                const reqPos = skill.cost?.position;
                return (!reqPos || reqPos === pos) && !fallbackUsedNames.has(skill.name);
            });
            if (validSkills.length > 0) {
                const selectedSkill = validSkills[Math.floor(Math.random() * validSkills.length)];
                fallbackLoadout[category] = selectedSkill;
                fallbackUsedNames.add(selectedSkill.name);
            }
            // If validSkills is empty, the slot remains empty (undefined)
        }
        return fallbackLoadout;
    };
    // Handle Midline Units (Silhouette, Mannequin)
    if (template.base.position === 'mid') {
        newUnit.position = Math.random() > 0.5 ? 'front' : 'back'; 
        newUnit.frontSkills = getLoadoutForPosition('front');
        newUnit.backSkills = getLoadoutForPosition('back');
        newUnit.skills = newUnit.position === 'front' ? {...newUnit.frontSkills} : {...newUnit.backSkills};
    } else newUnit.skills = getLoadoutForPosition(newUnit.position);
    // Initialize passives and augments safely
    newUnit.skills.passive?.code?.call(newUnit);
    newUnit.skills.augment?.code?.call(newUnit);
}

function frontTest() {
    const playersAlive = unitFilter('player', 'front', false);
    const enemiesAlive = unitFilter('enemy', 'front', false);
    if (!playersAlive.length) {
        const midLine = unitFilter('player', 'mid', false);
        if (midLine.length) {
            for (const unit of midLine) {
                unit.switchPosition();
                unit.timer += 1000;
            }
            logAction(`All player midline units moved to the frontline!`, 'turn');
        } else return !!showMessage('Defeat!', 'error', 'message-container', 0);
    }
    
    if (!enemiesAlive.length) {
        const midLine = unitFilter('enemy', 'mid', false);
        if (midLine.length) {
            for (const unit of midLine) {
                unit.switchPosition();
                unit.timer += 1000;
            }
            logAction(`All enemy midline units moved to the frontline!`, 'turn');
        } else if (advanceWave() && !unitFilter('enemy', 'front', false).length) return !! showMessage('Victory!', 'success', 'message-container', 0);
    }
}

// ============================================
// INITIALIZATION
// ============================================

window.combatTick = combatTick;
window.updateModifiers = updateModifiers;

// Initialize tab switching and inspector controls when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initTabSwitching();
    initInspectorControls();
    initSpeedControls();
});
// --- PAGE TRANSITION HANDLER ---
document.addEventListener('DOMContentLoaded', () => {
    const pendingSquad = localStorage.getItem('pendingSquad');
    if (pendingSquad) {
        // Clear the data so it doesn't trigger again on refresh
        localStorage.removeItem('pendingSquad');
        initializeCombatFromSquad(JSON.parse(pendingSquad));
    } else startCombat(); 
});

function getSkillCategory(template, skillObj) {
    for (const cat in template.skills) {
        const skills = Array.isArray(template.skills[cat]) ? template.skills[cat] : [template.skills[cat]];
        if (skills.includes(skillObj)) return cat;
    }
    return null;
}
const unitLookup = {
    [DexSoldier.name]: DexSoldier,
    [FourArcher.name]: FourArcher,
    [Mannequin.name]: Mannequin,
    [Silhouette.name]: Silhouette
};
function initializeCombatFromSquad(squadData) {
    // Hide any selection panels that might exist on the page
    const selectionPanel = document.getElementById('unit-selection-panel');
    if (selectionPanel) selectionPanel.style.display = 'none';
    // Show the new grid layout
    const gameLayout = document.querySelector('.game-layout');
    if (gameLayout) gameLayout.style.display = 'flex';
    // Reconstruct the units
    squadData.forEach(unitConfig => {
        const ref = unitLookup[unitConfig.templateName];
        const newUnit = createUnit(ref, 'player');  
        // Map equipped skills to their categories (e.g., newUnit.skills.basic = <skillObj>)
        newUnit.skills = {};
        if (newUnit.base.position === 'mid') {
            newUnit.position = unitConfig.startingPosition;
            newUnit.frontSkills = {};
            newUnit.backSkills = {};
            for (const skill of unitConfig.skills.front ) newUnit.frontSkills[skill.category] = ref.skills[skill.category].find(s => s.name === skill.name);
            for (const skill of unitConfig.skills.back ) newUnit.backSkills[skill.category] = ref.skills[skill.category].find(s => s.name === skill.name);
            // Set initial skills based on starting position
            newUnit.skills = unitConfig.startingPosition === 'front' ? {...newUnit.frontSkills} : {...newUnit.backSkills};
        } else for (const skill of unitConfig.skills ) newUnit.skills[skill.category] = ref.skills[skill.category].find(s => s.name === skill.name);
        newUnit.skills.passive?.code?.call?.(newUnit);
        newUnit.skills.augment?.code?.call?.(newUnit);
        // Auto-battler properties
        newUnit.autoBehavior = (newUnit.skills[unitConfig.autoBehavior] && unitConfig.autoBehavior) || (newUnit.skills.basic ? 'basic' : newUnit.skills.secondary ? 'secondary' : 'none');
        newUnit.specialReady = true;
    });
    // Spawn Enemies
    if (wave > 0) for (const e of waveCalc(unitFilter("player", ""), .5)) assignEnemySkills(createUnit(e, 'enemy'), e);
    // Start the Auto-Battle Loop
    updateBattleDisplay();
    combatTick();
}