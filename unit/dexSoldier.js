import { eventState, unitFilter } from '../combatDictionary.js';
import { Unit } from './unit.js';

export const DexSoldier = new Unit("DeX (Soldier)", [1800, 25, 55, 70, 50, 60, 80, 55, 200, "front", 160, 150, 18]);

const skills = {
    special: [
        {
            name: "Hammer, Hammer, Hammer!",
            properties: ["physical", "stamina", "attack"],
            cost: { stamina: 30 },
            description: "Cost 30 stamina\nAttacks a single target with increased attack, accuracy, and focus.",
            target: () => this.stamina < 30 ? showMessage("Not enough stamina!", "error", "selection") : this.team === "player" ? selectTarget(this.actions.special, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.special.code(randTarget(unitFilter("player", "front", false))),
            code: (target) => {
                this.stamina -= 30;
                this.previousAction[0] = true;
                logAction(`${this.name} powerfully swings a hammer at ${target[0].name}!`, "crit");
                attack(this, target, 1, { attacker: { attack: this.attack + 50, accuracy: this.accuracy + 105, focus: this.focus + 60 } });
            }
        },
        {
            name: "Determination",
            properties: ["physical", "stamina", "heal"],
            cost: { stamina: 50 },
            description: `Cost 50 stamina\nImmediately heals a lot (${this.healFactor * 2} HP) and moderately heals (${this.healFactor} HP) at start of turn for next 5 turns`,
            code: () => {
                if (this.stamina < 50) return showMessage("Not enough stamina!", "error", "selection");
                this.stamina -= 50;
                this.previousAction[0] = true;
                new Modifier("Determination", `Moderately heals${this.team === "player" ? ` (${this.healFactor} HP)` : ''} at start of turn whenever stamina is at least half`,
                    { caster: this, target: this, duration: 5, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true, unitChange: false }, cancel: false, applied: true, focus: true },
                    function() {
                        if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this, unit: this.vars.target, resource: ['hp'], value: [2 * this.vars.target.healFactor] });
                        this.vars.target.hp = Math.min(this.vars.target.hp + 2 * this.vars.target.healFactor, this.vars.target.base.hp);
                        logAction(`${this.vars.target.name} held onto hope and healed${this.vars.target.team === "player" ? ` ${this.vars.target.healFactor} HP` : ''}!`, "buff");
                    },
                    function(context) {
                        if (this.vars.listeners.unitChange && context.unit === this.vars.target && context.type === "revive") this.cancel(false);
                        else if (this.vars.applied && context.unit === this.vars.target) {
                            if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this, unit: this.vars.target, resource: ['hp'], value: [this.vars.target.healFactor] });
                            this.vars.target.hp = Math.min(this.vars.target.hp + this.vars.target.healFactor, this.vars.target.base.hp);
                            logAction(`${this.vars.target.name} held onto hope and healed${this.vars.target.team === "player" ? ` ${this.vars.target.healFactor} HP` : ''}!`, "buff");
                        }
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.unitChange = true;
                                eventState.unitChange.push(this);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.unitChange = false;
                                eventState.unitChange.splice(eventState.unitChange.indexOf(this), 1);
                            }
                        }
                    }
                );
            }
        },
        {
            name: "But It Refused",
            properties: ["physical", "stamina", "revive"],
            cost: { stamina: 50 },
            description: `Cost 50 stamina\nRevives once per turn for the next 5 turns`,
            code: () => {
                if (this.stamina < 50) return showMessage("Not enough stamina!", "error", "selection");
                this.stamina -= 50;
                this.previousAction[0] = true;
                new Modifier("But It Refused", `Revives once per turn`,
                    { caster: this, target: this, duration: 5, properties: ["physical", "stamina", "revive"], listeners: { turnStart: true, unitChange: true }, cancel: false, applied: true, focus: false, uses: 1 },
                    function() {},
                    function(context) {
                        if (this.vars.listeners.unitChange && context.unit === this.vars.target && context.type === "downed") {
                            if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this, unit: this.vars.target, resource: ['hp'], value: [3 * this.vars.target.healFactor] });
                            if (eventState.unitChange.length) handleEvent('unitChange', {type: 'revive', unit: this.vars.target});
                            this.vars.target.hp = 3 * this.vars.target.healFactor;
                            logAction(`${this.vars.target.name} refused to die and healed${this.vars.target.team === "player" ? ` ${3 * this.vars.target.healFactor} HP` : ''}!`, "buff");
                            this.vars.uses--;
                            this.cancel(true);
                        }
                        if (context.event === "turnStart" && context.unit === this.vars.caster) {
                            this.vars.duration--;
                            if (!this.vars.uses) {
                                this.vars.uses++;
                                this.cancel(false);
                            }
                        }
                        return this.vars.duration <= 0;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.unitChange = true;
                                eventState.unitChange.push(this);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.unitChange = false;
                                eventState.unitChange.splice(eventState.unitChange.indexOf(this), 1);
                            }
                        }
                    }
                );
            }
        },
        {
            name: "Guardian",
            properties: ["physical", "stamina"],
            cost: { stamina: 70 },
            description: "Cost 70 stamina\nRedirects all non-aoe attacks on the frontline to self with increased defense for 1 turn",
            code: () => {
                if (this.stamina < 70) return showMessage("Not enough stamina!", "error", "selection");
                this.stamina -= 70;
                this.previousAction[0] = true;
                logAction(`${this.name} guards the frontline!`, "buff");
                new Modifier("Guardian", "Redirects attacks and increases defense",
                    { caster: this, target: this, duration: 1, properties: ["physical", "stamina"], stats: { defense: 40 }, listeners: { attackStart: true, turnStart: true }, cancel: false, applied: true, focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {
                        if (!currentAction.at(-2)?.properties?.includes("aoe") && !currentAction.at(-2)?.vars?.properties?.includes("aoe") && context.event === "attackStart" && context.attacker.team !== this.vars.target.team) {
                            for (let i = 0; i < context.defenders.length; i++) {
                                const target = context.defenders[i];
                                if (target === this.vars.target || target.team !== this.vars.target.team || target.position !== "front" || !context.calcMods.defenders?.[i]?.redirect) continue;
                                context.defenders[i] = this.vars.target;
                                ((context.calcMods.defenders ??= [])[i] ??= {}).redirect = [target, this.vars.target];
                            }
                        }
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    },
                    function() {
                        if (this.vars.cancel && this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false);
                            this.vars.applied = false;
                            this.vars.listeners.attackStart = false;
                            eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                            this.vars.applied = true;
                            this.vars.listeners.attackStart = true;
                            eventState.attackStart.push(this);
                        }
                    }
                );
            }
        },
        {
            name: "Last Stand",
            properties: ["physical", "stamina", "buff"],
            cost: { stamina: 30 },
            description: "Cost 30 stamina\nIncreases defense, resist, and presence for 3 turns",
            code: () => {
                if (this.stamina < 30) return showMessage("Not enough stamina!", "error", "selection");
                this.stamina -= 30;
                this.previousAction[0] = true;
                logAction(`${this.name} prepares for a last stand!`, "crit");
                basicModifier("Last Stand", "Defense, resist, and presence increase", { caster: this, target: this, duration: 4, properties: ["physical", "stamina", "buff"], stats: { defense: 35, resist: 60, presence: 150 }, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
            }
        }
    ],
    basic: [
        {
            name: "Hammer, Hammer, Hammer!",
            properties: ["physical", "attack"],
            description: "Attacks a single target with increased attack, accuracy, and focus.",
            code: () => {
                this.previousAction[0] = true;
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                logAction(`${this.name} swings a hammer at ${target[0].name}`, "action");
                attack(this, target, 1, { attacker: { attack: this.attack + 50, accuracy: this.accuracy + 70 } });
            }
        },
        {
            name: "Determination",
            properties: ["physical", "stamina", "heal"],
            cost: { stamina: 10 },
            description: `Cost 10 stamina\nModerately heals (${this.healFactor} HP) at start of turn for next 3 turns`,
            code: () => {
                if (this.stamina < 10) return showMessage("Not enough stamina!", "error", "selection");
                this.stamina -= 10;
                this.previousAction[0] = true;
                new Modifier("Determination", `Moderately heals${this.team === "player" ? ` (${this.healFactor} HP)` : ''} at start of turn whenever stamina is at least half`,
                    { caster: this, target: this, duration: 3, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true, unitChange: false }, cancel: false, applied: true, focus: true },
                    function() {},
                    function(context) {
                        if (context.event === "unitChange" && context.unit === this.vars.target && context.type === "revive") this.cancel(false);
                        else if (this.vars.applied && context.unit === this.vars.target) {
                            if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this, unit: this.vars.target, resource: ['hp'], value: [this.vars.target.healFactor] });
                            this.vars.target.hp = Math.min(this.vars.target.hp + this.vars.target.healFactor, this.vars.target.base.hp);
                            logAction(`${this.vars.target.name} held onto hope and healed${this.vars.target.team === "player" ? ` ${this.vars.target.healFactor} HP` : ''}!`, "buff");
                        }
                        if (context.event === 'turnStart' && context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.unitChange = true;
                                eventState.unitChange.push(this);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.unitChange = false;
                                eventState.unitChange.splice(eventState.unitChange.indexOf(this), 1);
                            }
                        }
                    }
                );
            }
        },
        {
            name: "Guardian",
            properties: ["physical", "stamina"],
            cost: { stamina: 50 },
            description: "Cost 50 stamina\nRedirects all non-aoe attacks on lowest hp frontline unit to self for 1 turn",
            code: () => {
                if (this.stamina < 50) return showMessage("Not enough stamina!", "error", "selection");
                this.stamina -= 50;
                this.previousAction[0] = true;
                logAction(`${this.name} guards!`, "buff");
                new Modifier("Guardian", "Redirects attacks from an ally and increases defense",
                    { caster: this, target: this, duration: 1, properties: ["physical", "stamina"], listeners: { attackStart: true, turnStart: true }, cancel: false, applied: true, focus: true },
                    function() { },
                    function(context) {
                        if (!currentAction.at(-2)?.properties?.includes("aoe") && !currentAction.at(-2)?.vars?.properties?.includes("aoe") && context.event === "attackStart" && context.attacker.team !== this.vars.caster.team) {
                            for (let target of context.defenders) {
                                const index = context.defenders.indexOf(target);
                                if (target === this.vars.caster || target.team !== this.vars.caster.team || target.position !== "front" || !context.calcMods.defenders[index].redirect) continue;
                                context.defenders.splice(index, 1, this.vars.caster);
                                ((context.calcMods.defenders ??= [])[index] ??= {}).redirect = [target, this.vars.caster];
                            }
                        }
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false);
                                this.vars.applied = false;
                                this.vars.listeners.attackStart = false;
                                eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                                this.vars.applied = true;
                                this.vars.listeners.attackStart = true;
                                eventState.attackStart.push(this);
                            }
                        }
                    }
                );
            }
        }
    ],
    secondary: [
        {
            name: "Hammer, Hammer, Hammer!",
            properties: ["attack"],
            description: "Attacks a single target with increased attack, accuracy, and focus.",
            code: () => {
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                logAction(`${this.name} quickly swings a hammer at ${target[0].name}`, "action");
                attack(this, target, 1, { attacker: { attack: this.attack + 50 } });
            }
        },
        {
            name: "Determination",
            properties: ["physical", "heal"],
            description: `Moderately heals (${this.healFactor} HP) at start of next turn`,
            code: () => {
                this.previousAction[0] = true;
                new Modifier("Determination", `Moderately heals${this.team === "player" ? ` (${this.healFactor} HP)` : ''} at start of next turn`,
                    { caster: this, target: this, duration: 1, properties: ["physical", "heal"], listeners: { turnStart: true, unitChange: false }, cancel: false, applied: true, focus: true },
                    function() {},
                    function(context) {
                        if (this.vars.listeners.unitChange && context.unit === this.vars.target && context.type === "revive") this.cancel(false);
                        else if (this.vars.applied && context.unit === this.vars.target) {
                            if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this, unit: this.vars.target, resource: ['hp'], value: [this.vars.target.healFactor] });
                            this.vars.target.hp = Math.min(this.vars.target.hp + this.vars.target.healFactor, this.vars.target.base.hp);
                            logAction(`${this.vars.target.name} held onto hope and healed${this.vars.target.team === "player" ? ` ${this.vars.target.healFactor} HP` : ''}!`, "buff");
                        }
                        if (context.event === "turnStart" && context.unit === this.vars.caster) this.vars.duration--;
                        if (this.vars.duration <= 0) return true
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.unitChange = true;
                                eventState.unitChange.push(this);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.unitChange = false;
                                eventState.unitChange.splice(eventState.unitChange.indexOf(this), 1);
                            }
                        }
                    }
                );
            }
        },
        {
            name: "Last Stand",
            properties: ["buff"],
            description: "Increases defense and presence for 1 turn",
            code: () => {
                logAction(`${this.name} stands there.`, "crit");
                basicModifier("Last Stand", "Defense and presence increase", { caster: this, target: this, duration: 1, properties: ["physical", "buff"], stats: { defense: 15, presence: 50 }, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
            }
        }
    ],
    passive: [
        {
            name: "Determination",
            properties: ["physical", "stamina", "heal"],
            cost: { stamina: this.base.stamina / 2 },
            description: `Heals (${this.healFactor} HP) at start of turn whenever stamina is at least half`,
            code: () => {
                new Modifier("Determination", `Heals${this.team === "player" ? ` (${this.healFactor} HP)` : ''} at start of turn whenever stamina is at least half`,
                    { caster: this, target: this, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true, unitChange: false }, cancel: false, applied: true, focus: true, passive: true },
                    function() {},
                    function(context) {
                        if (this.vars.listeners.unitChange && context.unit === this.vars.target && context.type === "revive") this.cancel(false);
                        else if (this.vars.applied && context.unit === this.vars.target && 2 * this.vars.target.stamina >= this.vars.target.base.stamina) {
                            if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this, unit: this.vars.target, resource: ['hp'], value: [this.vars.target.healFactor] });
                            this.vars.target.hp = Math.min(this.vars.target.hp + this.vars.target.healFactor, this.vars.target.base.hp);
                            logAction(`${this.vars.target.name} held onto hope and healed${this.vars.target.team === "player" ? ` ${this.vars.target.healFactor} HP` : ''}!`, "buff");
                        }
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.turnStart = false;
                                eventState.turnStart.splice(eventState.turnStart.indexOf(this), 1);
                                this.vars.listeners.unitChange = true;
                                eventState.unitChange.push(this);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.unitChange = false;
                                eventState.unitChange.splice(eventState.unitChange.indexOf(this), 1);
                                this.vars.listeners.turnStart = true;
                                eventState.turnStart.push(this);
                            }
                        }
                    }
                );
            }
        },
        {
            name: "But It Refused",
            properties: ["physical", "stamina", "revive"],
            cost: { stamina: 30 },
            description: `Cost 30 stamina\nRevives if have enough stamina`,
            code: () => {
                new Modifier("But It Refused", `Revives`,
                    { caster: this, target: this, properties: ["physical", "stamina", "revive"], listeners: { unitChange: true }, cancel: false, applied: true, focus: false, passive: true },
                    function() {},
                    function(context) {
                        if (this.vars.listeners.unitChange && context.unit === this.vars.target && context.type === "downed" && this.vars.target.stamina >= 30) {
                            if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this, unit: this.vars.target, resource: ['stamina', 'hp'], value: [-30, 3 * this.vars.target.healFactor] });
                            this.vars.target.stamina -= 30;
                            this.vars.target.hp = 3 * this.vars.target.healFactor;
                            logAction(`${this.vars.target.name} refused to die and healed${this.vars.target.team === "player" ? ` ${3 * this.vars.target.healFactor} HP` : ''}!`, "buff");
                            if (eventState.unitChange.length) handleEvent('unitChange', {type: 'revive', unit: this.vars.target});
                        }
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) this.vars.applied = false;
                            else if (!this.vars.cancel && !this.vars.applied) this.vars.applied = true;
                        }
                    }
                );
            }
        },
        {
            name: "Guardian",
            properties: ["physical", "stamina"],
            cost: { stamina: 5 },
            description: "Spends 5 stamina per redirect to redirect all non-aoe attacks on lowest hp frontline unit to self",
            code: () => {
                new Modifier("Guardian", "Redirects attacks",
                    { caster: this, target: this, duration: 1, properties: ["physical", "stamina"], listeners: { attackStart: true }, cancel: false, applied: true, focus: true, passive: true },
                    function() { },
                    function(context) {
                        if (this.vars.caster.stamina >= 5 && !currentAction.at(-2)?.properties?.includes("aoe") && !currentAction.at(-2)?.vars?.properties?.includes("aoe") && context.event === "attackStart" && context.attacker.team !== this.vars.target.team) {
                            for (let i = 0; i < context.defenders.length; i++) {
                                const target = context.defenders[i];
                                if (this.vars.caster.stamina < 5 ||target === this.vars.target || target.team !== this.vars.target.team || target.position !== "front" || context.calcMods.defenders?.[i]?.redirect) continue;
                                context.defenders[i] = this.vars.target;
                                ((context.calcMods.defenders ??= [])[i] ??= {}).redirect = [target, this.vars.target];
                                if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this, unit: this.vars.target, resource: ['stamina'], value: [-10] });
                                this.vars.caster.stamina -= 10;
                            }
                        }
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.attackStart = false;
                                eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.attackStart = true;
                                eventState.attackStart.push(this);
                            }
                        }
                    }
                );
            }
        },
        {
            name: "Last Stand",
            properties: ["buff"],
            description: "Increases defense and presence",
            code: () => {
                new Modifier("Last Stand", "Increases defense and presence", { caster: this, target: this, properties: ["physical", "buff"], stats: { defense: 15, presence: 100 }, cancel: false, applied: true, focus: true, passive: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {},
                    function() {
                        if (this.vars.cancel && this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false);
                            this.vars.applied = false;
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                            this.vars.applied = true;
                        }
                    }
                );
            }
        }
    ],
    augment: [
        {
            name: "Determination",
            properties: ["physical", "stamina", "heal"],
            cost: { stamina: this.base.stamina / 2 },
            description: `Moderately heals (${Math.round(1.5 * this.healFactor)} HP) at start of turn whenever stamina is at least half`,
            code: () => {
                new Modifier("Determination", `Moderately heals${this.team === "player" ? ` (${Math.round(1.5 * this.healFactor)} HP)` : ''} at start of turn whenever stamina is at least half`,
                    { caster: this, target: this, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true, unitChange: false }, cancel: false, applied: true, focus: true, passive: true },
                    function() {},
                    function(context) {
                        if (this.vars.listeners.unitChange && context.unit === this.vars.target && context.type === "revive") this.cancel(false);
                        else if (this.vars.applied && this.vars.target === context?.unit && 2 * this.vars.target.stamina >= this.vars.target.base.stamina) {
                            if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this, unit: this.vars.target, resource: ['hp'], value: [Math.round(1.5 * this.vars.target.healFactor)] });
                            this.vars.target.hp = Math.min(this.vars.target.hp + Math.round(1.5 * this.vars.target.healFactor), this.vars.target.base.hp);
                            logAction(`${this.vars.target.name} held onto hope and healed${this.vars.target.team === "player" ? ` ${Math.round(1.5 * this.vars.target.healFactor)} HP` : ''}!`, "buff");
                        }
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.turnStart = false;
                                eventState.turnStart.splice(eventState.turnStart.indexOf(this), 1);
                                this.vars.listeners.unitChange = true;
                                eventState.unitChange.push(this);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.unitChange = false;
                                eventState.unitChange.splice(eventState.unitChange.indexOf(this), 1);
                                this.vars.listeners.turnStart = true;
                                eventState.turnStart.push(this);
                            }
                        }
                    }
                );
            }
        },
        {
            name: "Last Stand",
            properties: ["buff"],
            description: "Increases defense, resist, and presence",
            code: () => {
                new Modifier("Last Stand", "Increases defense, resist, and presence", { caster: this, target: this, properties: ["physical", "buff"], stats: { defense: 20, resist: 20, presence: 125 }, cancel: false, applied: true, focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {},
                    function() {
                        if (this.vars.cancel && this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false);
                            this.vars.applied = false;
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                            this.vars.applied = true;
                        }
                    }
                );
            }
        }
    ]
}