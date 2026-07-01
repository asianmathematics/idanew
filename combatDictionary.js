const allUnits = [];
const modifiers = [];
let currentUnit = null;
const currentAction = [];
const elements = ["precision/perfection", "independence/loneliness", "passion/hatred", "ingenuity/insanity"];
const eventState = {};
const events = [
    'turnStart', 'resistStart', 'attackStart', 'critStart', 'damageStart', 'healStart', 'modifierStart', 'stun', 'resourceChange',
    'turnEnd', 'singleResist', 'singleAttack', 'singleCrit', 'singleDamage', 'singleHeal', 'modifierEnd', 'cancel', 'costChange',
    'actionStart', 'targets', 'positionChange', 'waveChange', 'unitChange', 'statChange'
];
events.forEach(type => eventState[type] = []);

function setUnit(unit) { currentUnit = unit }

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

function unitFilter(team, position, downed = null) { return allUnits.filter(unit => (team === '' || unit.team === team) && (position === "mid" ? unit.base.position === "mid" : position === '' || unit.position === position) && (downed === null ? true : (downed ? unit.hp <= 0 : unit.hp > 0))) }

class Modifier {
    constructor(name, description, vars, initFunc, onTurnFunc, cancelFunc, changeTargetFunc) {
        this.name = name;
        this.description = description;
        this.vars = vars;
        this.init = initFunc;
        this.onTurn = onTurnFunc;
        this.cancel = (cancel = true, temp = false) => {
            if (eventState.cancel.length && !temp) handleEvent('cancel', { modifier: this, cancel });
            cancel ? this.vars.cancel++ : this.vars.cancel--;
            if (cancelFunc) (cancelFunc).apply(this, [cancel, temp]);
            else {
                const isActivating = !cancel && !this.vars.applied, isDeactivating = cancel && this.vars.applied;
                if (isDeactivating || isActivating) {
                    if (this.vars.stats) resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false);
                    if (!temp && this.vars.cancelListeners) {
                        if (this.vars.cancelListeners) {
                        for (const listener of this.vars.cancelListeners) {
                            this.vars.listeners[listener] = isActivating;
                            if (isActivating) eventState[listener].push(this);
                            else if (isDeactivating) eventState[listener].splice(eventState[listener].indexOf(this), 1);
                        }
                    }
                    }
                    this.vars.applied = isActivating;
                }
            }
        }
        this.changeTarget = changeTargetFunc || this.vars.targets ? ((remove = [], add = []) => {
            if (!add.length && remove.length === this.vars.targets.length) removeModifier(this);
            else {
                if (this.vars.applied) {
                    this.cancel(true, true);
                    for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                    this.vars.targets.push(...add);
                    this.cancel(false, true);
                } else {
                    for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                    this.vars.targets.push(...add);
                }
            }
        }) : ((unit) => {
            if (unit === this.vars.target) removeModifier(this);
            else {
                if (this.vars.applied) {
                    this.cancel(true, true);
                    this.vars.target = unit;
                    this.cancel(false, true);
                } else this.vars.target = unit;
            }
        });
        modifiers.push(this);
        if (this.vars.listeners) for (const eventType in this.vars.listeners) if (this.vars.listeners[eventType]) eventState[eventType].push(this);
        if (eventState.modifierStart.length) handleEvent('modifierStart', { modifier: this });
        currentAction.push(this);
        this.init() ? removeModifier(this) : this.vars.cancel = !(this.vars.applied = this.vars.start = true);
        currentAction.pop();
        window.updateModifiers();
    }
}

function handleEvent(eventType, context) {
    const eventList = [...eventState[eventType]];
    context.event = eventType;
    for (let i = eventList.length - 1; i >= 0; i--) {
        if (!eventList[i].vars.start || !eventState[eventType].includes(eventList[i])) continue;
        currentAction.push(eventList[i]);
        try {
            if (eventList[i] === currentAction.at(-3) && (eventList[i] === currentAction.at(-2) || eventList[i] === currentAction.at(-5))) {
                logAction(`Modifier ${eventList[i]?.name} was called too many times in one event!`, "error");
                continue;
            }
            if (eventList[i].onTurn(context)) removeModifier(eventList[i]);
        } catch (e) {
            console.error(`Error in ${eventType} listener (${eventList[i]?.name}):`, e);
            try {
                removeModifier(eventList[i]);
                logAction(`An error occurred with a modifier.`, "error");
            } catch (err) {
                logAction('A major error occurred with a modifier, event list has been purged', "error");
                modifiers.splice(0, modifiers.length, ...modifiers.filter(mod => mod !== eventList[i]));
                for (const event of events) if (eventState[event].length) eventState[event] = eventState[event].filter(mod => mod !== eventList[i]);
            }
        } finally { currentAction.pop() }
    }
    window.updateModifiers();
}

function removeModifier(modifier) {
    if ((modifier.vars.passive || modifier.vars.perm) && allUnits.includes(modifier.vars.caster)) {
        if (modifier.vars.caster.hp === 0 && modifier.vars.focus && !modifier.vars.perm) {
            currentAction.push(modifier);
            modifier.cancel();
            currentAction.pop();
        }
        return;
    }
    if (eventState.modifierEnd.length) handleEvent('modifierEnd', { modifier });
    if (modifier.vars?.applied) {
        currentAction.push(modifier);
        modifier.cancel();
        currentAction.pop();
    }
    if (modifier.vars?.listeners) for (const event in modifier.vars.listeners) if (modifier.vars.listeners[event] && eventState[event].indexOf(modifier) > -1) eventState[event].splice(eventState[event].indexOf(modifier), 1);
    const index = modifiers.indexOf(modifier);
    if (index !== -1) modifiers.splice(index, 1);
}

function basicModifier(name, description, vari) {
    return new Modifier(name, description, vari,
        function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
        function(context) {
            if (this.vars.target === context.unit) this.vars.duration--;
            return this.vars.duration <= 0;
        }
    );
}

new Modifier("Reapply Passive", "Reapplies passive modifiers on unit revive",
    { caster: null, target: null, properties: ["system"], listeners: { unitChange: true }, perm: true },
    function() {},
    function(context) { if (context.type === "revive") for (const mod of modifiers.filter(mod => mod.vars.caster === context.unit && mod.vars.passive)) mod.cancel(false) },
    function() {},
    function() {}
) //move to combat.js when created

function logAction(message, type = 'info') {
    const logContainer = document.getElementById('action-log');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}-entry`;
    logEntry.innerHTML = message;
    logContainer.appendChild(logEntry);
    /*const entries = logContainer.children;
    const maxEntries = window.innerWidth < 800 ? 100 : 250;
    while (entries.length > maxEntries) logContainer.removeChild(entries[0]);*/
    logContainer.scrollTop = logContainer.scrollHeight;
}

function resetStat(unit, statList, values = [], add = true) {
    if (values.length > 0) {
        /*console.log(values);*/
        if (eventState.statChange.length) handleEvent('statChange', { unit, statList, values, add });
        let nullCheck;
        for (let i = 0; i < Math.min(statList.length, values.length); i++) {
            if (values[i] !== values[i] || values[i] === undefined) {
                if (!nullCheck) {
                    logAction("Stat change has null values!", "error");
                    nullCheck = true;
                }
                continue;
            }
            unit.mult[statList[i]] += add ? values[i] : -values[i];
        }
    }
    for (const stat of statList) unit[stat] = unit.base[stat] + Math.max(-0.8 * unit.base[stat], unit.mult[stat] || 0);
}

function regenerateResources(unit) {
    if (eventState.resourceChange.length) { handleEvent('resourceChange', { effect: regenerateResources, unit, resource: [] }) }
    if (!unit.previousAction[0]) unit.stamina = Math.min(unit.base.stamina, Math.round(unit.stamina + unit.staminaRegen));
    if (unit.base.mana && !unit.previousAction[1]) unit.mana = Math.min(unit.base.mana, Math.round(unit.mana + unit.manaRegen));
    if (unit.base.energy && !unit.previousAction[2]) unit.energy = Math.min(unit.base.energy, Math.round(unit.energy + unit.energyRegen));
    unit.previousAction = [false, false, false];
}

function enemyTurn(unit) {
    const availableActions = {};
    let totalWeight = 0;
    for (const action in unit.actions.actionWeight) {
        let useable = true;
        if (unit.actions?.[action].cost) {
            for (const resource in unit.actions[action].cost) {
                if (resource === "position") continue;
                if (unit[resource] < unit.actions[action].cost[resource]) {
                    useable = false;
                    break;
                }
            }
        } if (useable) totalWeight += availableActions[action] = unit.actions.actionWeight[action];
    }
    if (totalWeight === 0) {
        showMessage(`${unit.name} has no available actions!`, "warning", "message-container");
        setTimeout(window.combatTick, 1000);
        return;
    }
    const randChoice = Math.random() * totalWeight;
    let cumulativeWeight = 0;
    for (const action in availableActions) {
        cumulativeWeight += unit.actions.actionWeight[action];
        if (randChoice <= cumulativeWeight) {
            if (action === "skip") {
                currentAction.push({ name: "Skip" });
                break;
            }
            currentAction.push(unit.actions[action]);
            if (eventState.actionStart.length) handleEvent('actionStart', {unit, action: unit.actions[action]});
            if (!unit.cancel) unit.actions[action].target ? unit.actions[action].target() : unit.actions[action].code();
            break;
        }
    }
    if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
    currentAction.pop();
    setTimeout(window.combatTick, 1000);
}

function randTarget(unitList = allUnits, count = 1, trueRand = false) {
    if (count >= unitList.length) {
        if (eventState.targets.length) handleEvent('targets', { selectedTargets: unitList, count, trueRand });
        return unitList;
    }
    if (count === 1) {
        if (trueRand) {
            if (eventState.targets.length) handleEvent('targets', { selectedTargets: unitList, count, trueRand });
            return [unitList[Math.floor(Math.random() * unitList.length)]];
        }
        const randChoice = Math.random() * unitList.reduce((sum, obj) => sum + obj.presence, 0);
        let cumulativePresence = 0;
        for (let obj of unitList) {
            cumulativePresence += obj.presence;
            if (randChoice <= cumulativePresence) {
                if (eventState.targets.length) handleEvent('targets', { selectedTargets: [obj], count, trueRand });
                return [obj];
            }
        }
    }
    let selectedTargets = [];
    const availableUnits = [ ...unitList];
    for (let i = 0; i < count && availableUnits.length > 0; i++) {
        let selectedUnit;
        if (trueRand) selectedUnit = availableUnits.splice(Math.floor(Math.random() * availableUnits.length), 1)[0];
        else {
            const randChoice = Math.random() * availableUnits.reduce((sum, obj) => sum + obj.presence, 0);
            let cumulativePresence = 0;
            for (let j = 0; j < availableUnits.length; j++) {
                cumulativePresence += availableUnits[j].presence;
                if (randChoice <= cumulativePresence) {
                    selectedUnit = availableUnits.splice(j, 1)[0];
                    break;
                }
            }
        } if (selectedUnit) selectedTargets.push(selectedUnit);
    }
    if (eventState.targets.length) handleEvent('targets', { selectedTargets, count, trueRand });
    return selectedTargets;
}


function playerTurn(unit) {
    let actionButton = `<h3 style="text-align:center;font-size:48px;margin:10px;"><b>${unit.name}'s turn</b></h3><div>`;
    for (const actionKey in unit.actions) {
        if (actionKey === "actionWeight") continue;
        const action = unit.actions[actionKey];
        let disabled = '';
        if (action.cost) {
            if (action.cost.position && action.cost.position !== unit.position) continue;
            for (const resource in action.cost) if (resource !== "position" && unit[resource] < action.cost[resource]) disabled = " disabled";
        }
        actionButton += `
        <button id='${action.name}' class='action-button${disabled}' onclick='handleActionClick(\"${actionKey}\", \"${unit.name}\")'>${action.name}</button>`;
    }
    document.getElementById("selection").innerHTML = `${actionButton}
        <button id='Skip' class='action-button' data-tooltip="Skip current unit's turn" onclick='handleActionClick("Skip", \"${unit.name}\")'>Skip</button>
    </div>`;
    window.handleActionClick = function(action, name) {
        const unit = allUnits.find(u => u.name === name);
        if (eventState.actionStart.length) handleEvent('actionStart', {unit, action: unit.actions[action]});
        if (!unit.cancel) {
            if (action === "Skip") {
                currentAction.push({ name: "Skip" });
                logAction(`${name}'s turn is skipped`, "miss");
                document.getElementById("selection").innerHTML = "";
                cleanupGlobalHandlers();
                if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
                currentAction.pop();
                setTimeout(window.combatTick, 500);
            } else {
                currentAction.push(unit.actions[action]);
                if (unit.actions[action].target !== undefined) unit.actions[action].target();
                else {
                    unit.actions[action].code();
                    document.getElementById("selection").innerHTML = "";
                    cleanupGlobalHandlers();
                    if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
                    currentAction.pop();
                    setTimeout(window.combatTick, 500);
                }
            }
        } else {
            if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
            setTimeout(window.combatTick, 500);
        }
    };
}

function selectTarget(action, back, target, targetType = 'unit') {
    let maxSelections = target[0];
    if (target[0] === -1 || target[0] > target[2].length) maxSelections = target[2].length;
    let selectionTitle = `<h2 style="text-align:center;">Action: ${action.name}</h2>`;
    let selectionForm = `<form id='targetSelection' onsubmit='submitTargetSelection(event)'>`;
    if (targetType === 'hex') selectionForm += `<div class="hex-selection-container">`;
    for (const obj of target[2]) {
        let objId, objLabel, objValue;
        if (targetType === 'hex') {
            const coords = `${obj.coord.q},${obj.coord.r},${obj.coord.s}`;
            objId = `hex-${obj.coord.q}-${obj.coord.r}-${obj.coord.s}`;
            objLabel = obj.name || `Hex (${coords})`;
            objValue = coords;
            selectionForm += `
            <div class="hex-option">
                <input type='${(maxSelections === 1) ? 'radio' : 'checkbox'}' id='${objId}' name='${objId}' value='${objValue}' onclick='checkTargetSelection(this, ${maxSelections})'>
                <label for='${objId}' class="hex-label ${obj.terrain ? `terrain-${obj.terrain}` : ''}">
                    ${objLabel}
                </label>
            </div>`;
        } else {
            objId = objLabel = objValue = obj.name;
            selectionForm += `
            <div>
                <input type='${(maxSelections === 1) ? 'radio' : 'checkbox'}' id='${objId}' name='targetSelection' value='${objValue}' onclick='checkTargetSelection(this, ${maxSelections})'>
                <label for='${objId}'>${objLabel}</label>
            </div>`;
        }
    }
    if (targetType === 'hex') selectionForm += `</div>`;
    document.getElementById("selection").innerHTML = `${selectionTitle}
        ${selectionForm}
        <div id='validation-message' style='color: red;'></div>
        <button type='submit' id='submit'>Submit</button>
    </form>
    <button id='back' onclick='exitTargetSelection()'>Back</button>`;

    function checkTargetSelection(input, maxSelections) {
        const selectedTargets = document.querySelectorAll('#targetSelection input[type="checkbox"]:checked, #targetSelection input[type="radio"]:checked');
        if (input.type === 'checkbox' && selectedTargets.length > maxSelections && input.checked) {
            input.checked = false;
            showMessage(`You can only select up to ${maxSelections} target${maxSelections !== 1 ? 's' : ''}.`, "error", "validation-message", 0);
        } else {
            const validationMsg = document.getElementById('validation-message');
            if (validationMsg) validationMsg.innerHTML = '';
        }
    };

    function submitTargetSelection(event) {
        event.preventDefault();
        const selectedInputs = document.querySelectorAll('#targetSelection input[type="checkbox"]:checked, #targetSelection input[type="radio"]:checked');
        if (target[1] && selectedInputs.length !== maxSelections) return showMessage(`Please select exactly ${maxSelections} target${maxSelections !== 1 ? 's' : ''}.`, "error", "validation-message", 0);
        if (selectedInputs.length === 0) return showMessage('Please select at least one target.', "error", "validation-message", 0);
        const selectedTargets = [];
        for (const input of selectedInputs) {
            if (targetType === 'hex') {
                const coords = input.value.split(',').map(Number);
                const targetHex = target[2].find(hex => hex.coord.q === coords[0] && hex.coord.r === coords[1] && hex.coord.s === coords[2]);
                if (targetHex) selectedTargets.push(targetHex);
            } else {
                const targetUnit = allUnits.find(unit => unit.name === input.value);
                if (targetUnit) selectedTargets.push(targetUnit);
            }
        }
        if (eventState.targets.length) handleEvent('targets', {action, selectedTargets});
        if (!currentUnit.cancel) action.code(selectedTargets);
        document.getElementById("selection").innerHTML = "";
        cleanupGlobalHandlers();
        if (eventState.turnEnd.length) { handleEvent('turnEnd', { unit: currentUnit }) }
        currentAction.pop();
        setTimeout(window.combatTick, 500);
    }

    function exitTargetSelection () { (back) ? back() : showMessage("Can't go back.", "warning", "message-container") }
    window.checkTargetSelection = checkTargetSelection;
    window.submitTargetSelection = submitTargetSelection;
    window.exitTargetSelection = exitTargetSelection;
}

function showMessage(message, type = 'info', elementId = 'message-container', duration = 3000) {
    let container = document.getElementById(elementId);
    if (!container) {
      container = document.createElement('div');
      container.id = elementId;
      container.className = 'message-container';
      document.body.appendChild(container);
    }
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}-message`;
    messageElement.textContent = message;
    container.appendChild(messageElement);
    if (duration > 0) setTimeout(() => messageElement.remove(), duration);
    return messageElement;
}

function cleanupGlobalHandlers() { window.checkTargetSelection = window.submitTargetSelection = window.exitTargetSelection = window.handleActionClick = null }

function attack(attacker, defenders, num = 1, calcMods = {}) {
    if (eventState.attackStart.length) handleEvent('attackStart', {attacker, defenders, num, calcMods});
    const attackMods = { ...attacker, ...calcMods.attacker };
    const array = [];
    for (let i = 0; i < defenders.length; i++) {
        const defendMods = { ...defenders[i], ...calcMods.all, ...calcMods.defenders?.[i] };
        const hit = [];
        for (let j = 0; j < num; j++) {
            let rolls = [];
            for (let r = 0; r <= Math.abs((calcMods.all?.reroll || 0) + (calcMods.defenders?.[i]?.reroll || 0)); r++) rolls.push(Math.floor(Math.random() * 100 + 1));
            const roll = (calcMods.all?.reroll || 0) + (calcMods.defenders?.[i]?.reroll || 0) < 0 ? Math.min(...rolls) : Math.max(...rolls);
            let hitSingle = roll === 1 ? 0 : roll - 50 * (roll === 100 ? .5*(((calcMods.max ??= [])[i] ??= [])[j] = true) : 1) * (.75 + (defendMods.evasion-attackMods.accuracy)/(attackMods.accuracy+defendMods.evasion));
            if (eventState.singleAttack.length) {
                const context = {attacker, defender: defenders[i], hitSingle, roll, calcMods, index: [i, j]};
                handleEvent('singleAttack', context);
                hitSingle = context.nil ? 0 : (hitSingle + (context.bonus || 0))*(context.mult || 1)/(context.div || 1) + (context.flatBonus || 0);
            }
            hit.push(hitSingle);
        }
        array.push(hit);
    }
    return crit(attacker, defenders, array, calcMods);
}

function crit(attacker, defenders, hit, calcMods = {}) {
    if (hit.length !== defenders.length) throw new TypeError(`Defender (${defenders}) and hit (${hit}) array lengths are not equal`);
    if (eventState.critStart.length) handleEvent('critStart', {attacker, defenders, hit, calcMods});
    const attackMods = { ...attacker, ...calcMods.attacker };
    const array = [];
    for (let i = 0; i < defenders.length; i++) {
        const defendMods = { ...defenders[i], ...calcMods.all, ...calcMods.defenders?.[i] };
        const critical = [];
        for (let j = 0; j < hit[i].length; j++) {
            let critSingle = Math.max(hit[i][j] <= 0 ? 0 : hit[i][j] / (25-10*(attackMods.focus-defendMods.resist)/(attackMods.focus+defendMods.resist)), (calcMods.max[i][j] || 0));
            if (eventState.singleCrit.length) {
                const context = {attacker, defender: defenders[i], critSingle, hit: hit[i][j], calcMods, index: [i, j]};
                handleEvent('singleCrit', context);
                critSingle = context.nil ? 0 : (critSingle + (context.bonus || 0))*(context.mult || 1)/(context.div || 1) + (context.flatBonus || 0);
            }
            critical.push(critSingle);
        }
        array.push(critical);
    }
    return damage(attacker, defenders, array, calcMods);
}

function damage(attacker, defenders, critical, calcMods = {}) {
    if (critical.length !== defenders.length) throw new TypeError(`Defender (${defenders}) and critical (${critical}) array lengths are not equal`);
    if (eventState.damageStart.length) handleEvent('damageStart', {attacker, defenders, critical, calcMods});
    const attackMods = { ...attacker, ...calcMods.attacker };
    const output = [];
    for (let i = 0; i < defenders.length; i++) {
        let dCheck = false;
        if (critical[i].some(c => c > 0)) {
            const defendMods = { ...defenders[i], ...calcMods.all, ...calcMods.defenders?.[i] };
            const hit = [];
            let total = 0;
            for (let j = 0; j < critical[i].length; j++) {
                let damageSingle = (critical[i][j] <= 0) ? 0 : Math.ceil(Math.max(((Math.random() * 0.5) + 0.75) * ((critical[i][j] < 1 ? 1 : critical[i][j] + 1) * ((2 * attackMods.attack) - defendMods.defense)), (critical[i][j] < 1 ? attackMods.attack : attackMods.attack * (critical[i][j] + 1))/8));
                if (eventState.singleDamage.length) {
                    const context = {attacker, defender: defenders[i], damageSingle, critical: critical[i][j], calcMods, index: [i, j]};
                    handleEvent('singleDamage', context);
                    damageSingle = context.nil ? 0 : Math.ceil(Math.max((damageSingle + (context.bonus || 0))*(context.mult || 1)/(context.div || 1) + (context.flatBonus || 0), (critical[i][j] < 1 ? attackMods.attack : attackMods.attack * (critical[i][j] + 1))/8));
                }
                hit.push(`${critical[i][j] <= 0 ? '<i>0</i>' : critical[i][j] >= 1 ? `<b>${damageSingle}</b>` : damageSingle}`);
                output.push(damageSingle);
                total += damageSingle;
            }
            if (total) {
                defenders[i].hp = Math.max(defenders[i].hp - total, 0);
                if (defenders[i].hp === 0) {
                    if (eventState.unitChange.length) handleEvent('unitChange', {type: 'downed', unit: defenders[i]});
                    if (defenders[i].hp === 0) for (const mod of modifiers) if (mod.vars.caster === defenders[i] && (mod.vars.focus || mod.vars.penalty)) removeModifier(mod);
                }
                critical[i].length > 1 ? logAction(`${attacker.name} makes ${critical[i].length} attacks on ${defenders[i].name} dealing ${hit.join(", ")} for a total of ${total} damage!`, "hit") : logAction(`${attacker.name} hits ${defenders[i].name} dealing ${hit[0]} damage!`, "hit");
                dCheck = true;
            }
        }
        if (!dCheck) logAction(`${attacker.name} missed ${critical[i].length > 1 ? `all ${critical[i].length} attacks on ` : '' }${defenders[i].name}!`, "miss");
    }
        return output
}

function heal(healer, targets, amount, calcMods = {}) {
    if (eventState.healStart.length) handleEvent('healStart', {healer, targets, calcMods});
    const heal = [];
    for (let i = 0; i < targets.length; i++) {
        let healSingle = Math.ceil(Math.max((calcMods.targets?.[i]?.healFactor || calcMods.all?.healFactor || targets[i].healFactor) * amount[i]));
        if (eventState.singleHeal.length) {
            const context = {healer, target: targets[i], healSingle, calcMods, index: [i]};
            handleEvent('singleHeal', context);
            healSingle = context.nil ? 0 : Math.ceil(Math.max((healSingle + (context.bonus || 0))*(context.mult || 1)/(context.div || 1) + (context.flatBonus || 0), 0));
        }
        const revive = !targets[i].hp && healSingle;
        targets[i].hp = Math.min(targets[i].hp + healSingle, targets[i].base.hp);
        if (revive && eventState.unitChange.length) handleEvent('unitChange', {type: 'revive', unit: targets[i]});
        heal.push(`${targets[i].name} ${healSingle} hp`);
    }
    logAction(`${healer.name} heals ${heal.join(", ")}!`, "heal");
}

function hpChange(unit, targets, values) {
    let defenders = [], damages = [], heals = [];
    for (let i = targets.length - 1; i >= 0; i--) {
        if (values[i] < 0) {
            defenders.push(targets.splice(i, 1)[0]);
            damages.push(-values[i]);
        } else heals.unshift(values[i]);
    }
    if (eventState.damageStart.length) handleEvent('damageStart', {attacker: unit, defenders, damages, direct: true});
    for (let i = 0; i < defenders.length; i++) {
        let damageSingle = damages[i];
        if (eventState.singleDamage.length) {
            const context = {attacker: unit, defender: defenders[i], damageSingle, index: [i], direct: true};
            handleEvent('singleDamage', context);
            damageSingle = context.nil ? 0 : Math.ceil(Math.max((damageSingle + (context.bonus || 0))*(context.mult || 1)/(context.div || 1) + (context.flatBonus || 0), 0));
        }
        defenders[i].hp = Math.max(defenders[i].hp - damageSingle, 0);
        if (defenders[i].hp === 0) {
            if (eventState.unitChange.length) handleEvent('unitChange', {type: 'downed', unit: defenders[i]});
            if (defenders[i].hp === 0) for (const mod of modifiers) if (mod.vars.caster === defenders[i] && (mod.vars.focus || mod.vars.penalty)) removeModifier(mod);
        }
        logAction(`${unit.name} dealt ${damageSingle} damage to ${defenders[i].name}!`, "hit");
    }
    if (eventState.healStart.length) handleEvent('healStart', {healer: unit, targets, heals, direct: true});
    for (let i = 0; i < targets.length; i++) {
        let healSingle = heals[i];
        if (eventState.singleHeal.length) {
            const context = {healer: unit, target: targets[i], healSingle, index: [i], direct: true};
            handleEvent('singleHeal', context);
            healSingle = context.nil ? 0 : Math.ceil(Math.max((healSingle + (context.bonus || 0))*(context.mult || 1)/(context.div || 1) + (context.flatBonus || 0), 0));
        }
        const revive = !targets[i].hp && healSingle;
        targets[i].hp = Math.min(targets[i].hp + healSingle, targets[i].base.hp);
        if (revive && eventState.unitChange.length) handleEvent('unitChange', {type: 'revived', unit: targets[i]});
        logAction(`${unit.name} heals ${targets[i].name} for ${healSingle} hp!`, "heal");
    }
}

function resistDebuff(attacker, defenders, calcMods = {}) {
    if (eventState.resistStart.length) handleEvent('resistStart', {attacker, defenders, calcMods});
    const attackMods = { ...attacker, ...calcMods.attacker };
    const will = [];
    for (let i = 0; i < defenders.length; i++) {
        const defendMods = { ...defenders[i], ...calcMods.all, ...calcMods.defenders?.[i] };
        let rolls = [];
        for (let r = 0; r <= Math.abs((calcMods.all?.reroll || 0) + (calcMods.defenders?.[i]?.reroll || 0)); r++) rolls.push(Math.floor(Math.random() * 100 + 1));
        const roll = (calcMods.all?.reroll || 0) + (calcMods.defenders?.[i]?.reroll || 0) < 0 ? Math.min(...rolls) : Math.max(...rolls);
        let resistSingle = roll === 1 || roll === 100 ? roll : roll + 50 * ((attackMods.presence + attackMods.focus - defendMods.presence - defendMods.resist) / (attackMods.presence + attackMods.focus + defendMods.presence + defendMods.resist));
        if (eventState.singleResist.length) {
            const context = {attacker, defender: defenders[i], resistSingle, calcMods, index: [i]};
            handleEvent('singleResist', context);
            resistSingle = context.nil ? 0 : (resistSingle + (context.bonus || 0))*(context.mult || 1)/(context.div || 1) + (context.flatBonus || 0);
        }
        will.push(Math.min(resistSingle, 100));
    }
    return will;
}

function resourceChange(unit, resources, drain = false) {
    const { position, ...actualResources } = resources;
    const context = {unit, resources: actualResources};
    if (eventState.resourceChange.length) handleEvent('resourceChange', context);
    for (const resource in context.resources) {
        context.resources[resource] = (context[resource]?.nil || context.all?.nil) ? 0 : (resources[resource] + (context[resource]?.bonus || 0) + (context.all?.bonus || 0))*(context[resource]?.mult || 1)*(context.all?.mult || 1)/(context[resource]?.div || 1)/(context.all?.div || 1) + (context[resource]?.flatBonus || 0) + (context.all?.flatBonus || 0);
        if (!drain && -context.resources[resource] > unit[resource]) return (currentAction.length === 1 && currentUnit.team === 'player') ? !showMessage(`Not enough ${resource}!`, "error", "selection") : false;
    }
    for (const resource in context.resources) unit[resource] = Math.ceil(Math.max(0, Math.min(unit[resource] + context.resources[resource], unit.base[resource])));
    return true
}

export { setUnit, sleep, unitFilter, Modifier, handleEvent, removeModifier, basicModifier, logAction, resetStat, regenerateResources, enemyTurn, randTarget, playerTurn, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, allUnits, modifiers, currentUnit, currentAction, elements, eventState };