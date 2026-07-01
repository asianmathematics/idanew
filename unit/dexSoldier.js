import { setUnit, sleep, unitFilter, Modifier, handleEvent, removeModifier, basicModifier, logAction, resetStat, regenerateResources, enemyTurn, randTarget, playerTurn, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, allUnits, modifiers, currentUnit, currentAction, elements, eventState } from '../combatDictionary.js';
import { Unit } from './unit.js';

export const DexSoldier = new Unit("DeX (Soldier)", [1800, 25, 55, 70, 50, 60, 80, 55, 200, "front", 300, 150, 27]);

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
                    { caster: this, target: this, duration: 5, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true }, focus: true },
                    function() { heal(this.vars.caster, [this.vars.target], [2]) },
                    function(context) {
                        if (this.vars.applied && context.unit === this.vars.target) heal(this.vars.caster, [this.vars.target], [1]);
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    },
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
                    { caster: this, target: this, duration: 5, properties: ["physical", "revive"], listeners: { turnStart: true, unitChange: true }, cancelListeners: ['unitChange'], focus: false, uses: 1 },
                    function() {},
                    function(context) {
                        if (this.vars.applied && context.unit === this.vars.target && context.type === "downed") {
                            heal(this.vars.caster, [this.vars.target], [3]);
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
                new Modifier("Guardian", "Redirects attacks and increases defense",
                    { caster: this, target: this, duration: 1, properties: ["physical"], stats: { defense: 40 }, listeners: { attackStart: true, turnStart: true }, cancelListeners: ['attackStart'], focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {
                        if (context.event === "attackStart" && context.attacker.team !== this.vars.target.team && !currentAction.at(-2)?.properties?.includes("aoe") && !currentAction.at(-2)?.vars?.properties?.includes("aoe")) {
                            let redirect = 0;
                            for (let i = 0; i < context.defenders.length; i++) {
                                const target = context.defenders[i];
                                if (target === this.vars.target || target.team !== this.vars.target.team || target.position !== "front" || !context.calcMods.defenders?.[i]?.redirect) continue;
                                redirect++;
                                context.defenders[i] = this.vars.target;
                                ((context.calcMods.defenders ??= [])[i] ??= {}).redirect = [target, this.vars.target];
                            }
                            if (redirect > 0) logAction(`${this.vars.target.name} redirects ${redirect} attack${redirect > 1 ? 's' : ''} to self!`, "crit");
                        }
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
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
                basicModifier("Last Stand", "Defense, resist, and presence increase", { caster: this, target: this, duration: 4, properties: ["physical", "buff"], stats: { defense: 35, resist: 60, presence: 150 }, listeners: {turnEnd: true}, focus: true });
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
                    { caster: this, target: this, duration: 3, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true },
                    function() {},
                    function(context) {
                        if (this.vars.applied && context.unit === this.vars.target) heal(this.vars.caster, [this.vars.target], [1]);
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Guardian",
            properties: ["physical", "stamina"],
            cost: { stamina: 40 },
            description: "Cost 40 stamina\nRedirects all non-aoe attacks on lowest hp frontline unit to self for 1 turn",
            code: () => {
                if (this.stamina < 40) return showMessage("Not enough stamina!", "error", "selection");
                this.stamina -= 40;
                this.previousAction[0] = true;
                new Modifier("Guardian", "Redirects attacks from an ally and increases defense",
                    { caster: this, target: this, duration: 1, properties: ["physical"], listeners: { attackStart: true, turnStart: true }, cancelListeners: ['attackStart'], focus: true },
                    function() {},
                    function(context) {
                        if (context.event === "attackStart" && context.attacker.team !== this.vars.caster.team && !currentAction.at(-2)?.properties?.includes("aoe") && !currentAction.at(-2)?.vars?.properties?.includes("aoe")) {
                            let lowestHpUnit = unitFilter(this.vars.caster.team, "front", false).reduce((lowest, unit) => unit.hp / unit.base.hp < lowest.hp / lowest.base.hp ? unit === this.vars.caster ? lowest : unit : lowest), redirect = 0;
                            if (eventState.targets.length) handleEvent('targets', { selectedTargets: lowestHpUnit, count: 1, trueRand: false });
                            for (let target of context.defenders) {
                                const index = context.defenders.indexOf(target);
                                if (target !== lowestHpUnit) continue;
                                context.defenders.splice(index, 1, this.vars.caster);
                                ((context.calcMods.defenders ??= [])[index] ??= {}).redirect = [target, this.vars.caster];
                                redirect++;
                            }
                            if (redirect > 0) logAction(`${this.vars.caster.name} redirects ${redirect} attack${redirect > 1 ? 's' : ''} to self!`, "crit");
                        }
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
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
                    { caster: this, target: this, duration: 1, properties: ["physical", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], cancel: false, applied: true, focus: true },
                    function() {},
                    function(context) {
                        if (this.vars.applied && context.unit === this.vars.target) heal(this.vars.caster, [this.vars.target], [1]);
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        if (this.vars.duration <= 0) return true
                    },
                );
            }
        },
        {
            name: "Last Stand",
            properties: ["buff"],
            description: "Increases defense and presence for 1 turn",
            code: () => { basicModifier("Last Stand", "Defense and presence increase", { caster: this, target: this, duration: 1, properties: ["physical", "buff"], stats: { defense: 15, presence: 50 }, listeners: {turnStart: true}, focus: true }) }
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
                    { caster: this, target: this, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) { if (this.vars.applied && context.unit === this.vars.target && 2 * this.vars.target.stamina >= this.vars.target.base.stamina) heal(this.vars.caster, [this.vars.target], [1]) }
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
                    { caster: this, target: this, properties: ["physical", "stamina", "revive"], listeners: { unitChange: true }, cancelListeners: ['unitChange'], focus: false, passive: true },
                    function() {},
                    function(context) {
                        if (this.vars.applied && context.unit === this.vars.target && context.type === "downed" && this.vars.target.stamina >= 30) {
                            resourceChange(this.vars.caster, { stamina: -30 });
                            heal(this.vars.caster, [this.vars.target], [3]);
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
                    { caster: this, target: this, duration: 1, properties: ["physical", "stamina"], listeners: { attackStart: true }, cancelListeners: ['attackStart'], focus: true, passive: true },
                    function() { },
                    function(context) {
                        if (this.vars.caster.stamina >= 5 && !currentAction.at(-2)?.properties?.includes("aoe") && !currentAction.at(-2)?.vars?.properties?.includes("aoe") && context.event === "attackStart" && context.attacker.team !== this.vars.target.team) {
                            let redirect = 0;
                            for (let i = 0; i < context.defenders.length; i++) {
                                const target = context.defenders[i];
                                if (this.vars.caster.stamina < 5 ||target === this.vars.target || target.team !== this.vars.target.team || target.position !== "front" || context.calcMods.defenders?.[i]?.redirect) continue;
                                context.defenders[i] = this.vars.target;
                                ((context.calcMods.defenders ??= [])[i] ??= {}).redirect = [target, this.vars.target];
                                resourceChange(this.vars.caster, { stamina: -5 });
                                redirect++;
                            }
                            if (redirect > 0) logAction(`${this.vars.caster.name} redirects ${redirect} attack${redirect > 1 ? 's' : ''} to self!`, "crit");
                        }
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Last Stand",
            properties: ["buff"],
            description: "Increases defense and presence",
            code: () => {
                new Modifier("Last Stand", "Increases defense and presence", { caster: this, target: this, properties: ["physical", "buff"], stats: { defense: 15, presence: 100 }, focus: true, passive: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function() {},
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
                    { caster: this, target: this, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], cancel: false, applied: true, focus: true, passive: true },
                    function() {},
                    function(context) { if (this.vars.applied && this.vars.target === context?.unit && 2 * this.vars.target.stamina >= this.vars.target.base.stamina) heal(this.vars.caster, [this.vars.target], [1.5]) }
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
                );
            }
        }
    ]
}