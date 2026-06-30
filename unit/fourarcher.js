import { attack, basicModifier, currentAction, eventState, logAction, Modifier, modifiers, randTarget, resistDebuff, unitFilter } from '../combatDictionary.js';
import { Unit } from './unit.js';

export const FourArcher = new Unit("4 (Archer)", [800, 24, 16, 50, 80, 70, 140, 85, 160, "back", 110, 40, 4, 160, 32]);

const skills = {
    special: [
        {
            name: "Perfect Shot",
            properties: ["mystic", "mana", "attack", "auto-hit", "auto-crit"],
            cost: { mana: 40 },
            description: "Cost 40 mana\nDeals a critical hit to a single target, 99% chance to ignore half of defense",
            target: () => this.mana < 40 ? showMessage("Not enough mana!", "error", "selection") : this.team === "player" ? selectTarget(this.actions.special, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.special.code(randTarget(unitFilter("player", "front", false))),
            code: (target) => {
                this.previousAction[1] = true;
                this.mana -= 40;
                logAction(`${this.name} shoots a powerful mystic arrow!`, "action");
                damage(this, target, [[4]], { defenders: { defense: resistDebuff(this, target)[0] < 2 ? target[0].defense : Math.ceil(Math.max(target[0].defense/2, target[0].base.defense * .2)) } });
            }
        },
        {
            name: "Unnatural Luck",
            properties: ["mystic", "mana", "buff", "debuff"],
            cost: { mana: 20 },
            description: "Cost 20 mana\nRolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has disadvantage until end of next turn, 1% chance to fail to give disadvantage.",
            code: () => {
                if (this.mana < 20) return showMessage("Not enough mana!", "error", "selection");
                this.previousAction[1] = true;
                this.mana -= 20;
                new Modifier("Unnatural Luck", "Rolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has disadvantage, 1% chance to fail to give disadvantage.",
                    { caster: this, target: this, duration: 2, properties: ["mystic", "buff", "debuff"], listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancel: false, applied: true, focus: false },
                    function() {},
                    function(context) {
                        if (context.event === "attackStart" || context.event === "resistStart") {
                            if (context.attacker === this.vars.caster) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                            if (context.defenders.includes(this.vars.caster) && resistDebuff(this.vars.caster, [context.attacker])[0] > 1) for (let i = 0; i < context.defenders.length; i++) if (context.defenders[i] === this.vars.caster) ((context.calcMods.defenders ??= [])[i] ??= { reroll: 0 }).reroll--;
                        }
                        else if (context.event === "turnEnd" && context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                for (const listener in this.vars.listeners) {
                                    this.vars.listeners[listener] = false;
                                    eventState[listener].splice(eventState[listener].indexOf(this), 1);
                                }
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                for (const listener in this.vars.listeners) {
                                    this.vars.listeners[listener] = true;
                                    eventState[listener].push(this);
                                }
                            }
                        }
                    }
                )
            }
        },
        {
            name: "Lazing Around",
            properties: ["physical", "stamina", "mana", "debuff", "resource"],
            cost: { stamina: 10 },
            description: "Cost 10 stamina\nReduces speed until next turn then regain mana.",
            code: () => {
                if (this.stamina < 10) return showMessage("Not enough stamina!", "error", "selection");
                this.previousAction[1] = true;
                this.stamina -= 10;
                new Modifier("Lazing Around", "Reduces speed and regen mana.",
                    { caster: this, target: this, duration: 1, properties: ["physical", "mana", "debuff", "resource"], stats: { speed: -10 }, listeners: { turnStart: true }, cancel: false, applied: true, focus: false, penalty: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) resourceChange(this.vars.caster, { mana: this.vars.caster.manaRegen * 2.5 });
                            this.vars.duration--;
                        }
                        return this.vars.duration <= 0;
                    },
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
        },
        {
            name: "Rebound Arc",
            properties: ["mystic", "mana", "buff"],
            cost: { mana: 40 },
            description: "Cost 40 mana\nMissed attacks have a chance to hit a random enemy and non-crit guaranteed hits can make an attack to pierce a random enemy for 4 turns",
            code: () => {
                if (this.mana < 40) return showMessage("Not enough mana!", "error", "selection");
                this.previousAction[1] = true;
                this.mana -= 40;
                new Modifier("Rebound Arc", "Missed attack have a chance to hit a random enemy and non-crit guaranteed hits can make an attack to pierce a random enemy",
                    { caster: this, target: this, duration: 5, properties: ["mystic", "buff"], listeners: { turnEnd: true, singleAttack: true, singleDamage: true }, cancel: false, applied: true, focus: false, attacking: false },
                    function() {},
                    function(context) {
                        if (this.vars.attacking) return;
                        if (context.event === "singleAttack" && context.attacker === this.vars.caster && context.hitSingle <= 0) {
                            this.vars.attacking = true;
                            let target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                            if (resistDebuff(this.vars.caster, [target])[0] > 70) crit(this.vars.caster, target, [[this.accuracy/2]]);
                        } else if (context.event === "singleDamage" && context.attacker === this.vars.caster && (currentAction.at(-2).properties?.includes("auto-hit") || currentAction.at(-2).vars?.properties?.includes("auto-hit")) && context.critical < 1) {
                            this.vars.attacking = true;
                            attack(this.vars.caster, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 1, context.calcMods);
                        }
                        this.vars.attacking = false;
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.singleAttack = false;
                                eventState.singleAttack.splice(eventState.singleAttack.indexOf(this), 1);
                                this.vars.listeners.singleDamage = false;
                                eventState.singleDamage.splice(eventState.singleDamage.indexOf(this), 1);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.singleAttack = true;
                                eventState.singleAttack.push(this);
                                this.vars.listeners.singleDamage = true;
                                eventState.singleDamage.push(this);
                            }
                        }
                    }
                )
            }
        },
        {
            name: "Lucky Aura",
            properties: ["mystic", "mana", "buff"],
            description: "Cost 40 mana\nIncreases all alive allies accuracy/evasion/focus/resist/presence for one of their turns",
            code: () => {
                if (this.mana < 40) return showMessage("Not enough mana!", "error", "selection");
                this.previousAction[1] = true;
                logAction(`${this.name} boosted ally luck!`, "action");
                for (const unit of unitFilter(this.team, '', false).filter(u => u !== this)) basicModifier("Lucky Aura", "Increases accuracy/evasion/focus/resist/presence", { caster: this, target: unit, duration: 2, properties: ["mystic", "buff"], stats: { accuracy: 25, evasion: 45, focus: 35, resist: 40, presence: 40 }, listeners: { turnStart: true }, cancel: false, applied: true, focus: false });
            }
        },
        {
            name: "Luck Arrow",
            properties: ["mystic", "mana", "attack", "auto-hit", "buff", "debuff"],
            description: "Cost 20 mana\nMakes a guaranteed hit to a single target, gives self advantage to next few attacks/debuffs depending on chance and chance to give disadvantage to target's next few attacks/debuffs, 1% chance to fail to give advantage",
            target: () => this.mana < 20 ? showMessage("Not enough mana!", "error", "selection") : this.team === "player" ? selectTarget(this.actions.special, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.special.code(randTarget(unitFilter("player", "front", false))),
            code: (target) => {
                this.previousAction[1] = true;
                logAction(`${this.name} hits a luck arrow!`, "action");
                attack(this, target, 1, { max: [[.5]] });
                let will = resistDebuff(this, target);
                new Modifier("Luck Arrow buff", "Gives advantage to next few attacks/debuffs",
                    { caster: this, target: this, duration: will[0] < 2 ? 0 : will[0] > 99 ? 7 : Math.ceil(will[0]/33), properties: ["mystic", "buff"], listeners: { attackStart: true, resistStart: true }, cancel: false, applied: true, focus: false },
                    function() { return !this.vars.duration },
                    function(context) {
                        if (this.vars.applied && context.attacker === this.vars.caster) this.vars.duration--, (context.calcMods.all ??= { reroll: 0 }).reroll++;
                        return this.vars.duration <= 0;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.attackStart = false;
                                eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                                this.vars.listeners.resistStart = false;
                                eventState.resistStart.splice(eventState.resistStart.indexOf(this), 1);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.attackStart = true;
                                eventState.attackStart.push(this);
                                this.vars.listeners.resistStart = true;
                                eventState.resistStart.push(this);
                            }
                        }
                    }
                );
                let will = resistDebuff(this.vars.caster, [this.vars.target]);
                new Modifier("Luck Arrow debuff", "Gives disadvantage to target's next few attacks/debuffs",
                    { caster: this, target: target, duration: will[0] > 99 ? 7 : Math.floor(will[0]/25), properties: ["mystic", "debuff"], listeners: { attackStart: true, resistStart: true }, cancel: false, applied: true, focus: false },
                    function() { return !this.vars.duration },
                    function(context) {
                        if (this.vars.applied && context.attacker === this.vars.target) this.vars.duration--, context.calcMods.all ? context.calcMods.all.reroll = (context.calcMods.all.reroll || 0) - 1 : context.calcMods.all = { reroll: -1 };
                        return this.vars.duration <= 0;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.attackStart = false;
                                eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                                this.vars.listeners.resistStart = false;
                                eventState.resistStart.splice(eventState.resistStart.indexOf(this), 1);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.attackStart = true;
                                eventState.attackStart.push(this);
                                this.vars.listeners.resistStart = true;
                                eventState.resistStart.push(this);
                            }
                        }
                    }
                )
            }
        }
    ],
    basic: [
        {
            name: "Perfect Shot",
            properties: ["mystic", "attack", "auto-hit"],
            description: "Makes a guaranteed hit to a single target, 99% to ignore some defense",
            code: () => {
                this.previousAction[1] = true;
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                logAction(`${this.name} shoots a mystic arrow.`, "action");
                attack(this, target, 1, { max: [[.5]], defenders: { defense: resistDebuff(this, target)[0] < 2 ? target[0].defense : Math.ceil(Math.max(target[0].defense/2, target[0].base.defense * .2)) } });
            }
        },
        {
            name: "Luck Arrow",
            properties: ["mystic", "mana", "attack", "auto-hit", "buff", "debuff"],
            description: "Attacks a single target, on hit, chance to give self advantage to next few attacks/debuffs and chance to give disadvantage to target's next few attacks/debuffs",
            code: () => {
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                this.previousAction[1] = true;
                logAction(`${this.name} fires a luck arrow.`, "action");
                if (attack(this, target, 1)[0] > 0) {
                    let will = resistDebuff(this, target);
                    new Modifier("Luck Arrow buff", "Gives advantage to next few attacks/debuffs",
                        { caster: this, target: this, duration: will[0] > 99 ? 7 : Math.ceil(will[0]/25), properties: ["mystic", "buff"], listeners: { attackStart: true, resistStart: true }, cancel: false, applied: true, focus: false },
                        function() { return !this.vars.duration },
                        function(context) {
                            if (this.vars.applied && context.attacker === this.vars.caster) this.vars.duration--, (context.calcMods.all ??= { reroll: 0 }).reroll++;
                            return this.vars.duration <= 0;
                        },
                        function(cancel, temp) {
                            if (!temp) {
                                if (this.vars.cancel && this.vars.applied) {
                                    this.vars.applied = false;
                                    this.vars.listeners.attackStart = false;
                                    eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                                    this.vars.listeners.resistStart = false;
                                    eventState.resistStart.splice(eventState.resistStart.indexOf(this), 1);
                                } else if (!this.vars.cancel && !this.vars.applied) {
                                    this.vars.applied = true;
                                    this.vars.listeners.attackStart = true;
                                    eventState.attackStart.push(this);
                                    this.vars.listeners.resistStart = true;
                                    eventState.resistStart.push(this);
                                }
                            }
                        }
                    );
                    let will = resistDebuff(this, target);
                    new Modifier("Luck Arrow debuff", "Gives disadvantage to target's next few attacks/debuffs",
                        { caster: this, target: target, duration: will[0] > 99 ? 4 : Math.floor(will[0]/33), properties: ["mystic", "debuff"], listeners: { attackStart: true, resistStart: true }, cancel: false, applied: true, focus: false },
                        function() { return !this.vars.duration },
                        function(context) {
                            if (this.vars.applied && context.attacker === this.vars.target) this.vars.duration--, context.calcMods.all ? context.calcMods.all.reroll = (context.calcMods.all.reroll || 0) - 1 : context.calcMods.all = { reroll: -1 };
                            return this.vars.duration <= 0;
                        },
                        function(cancel, temp) {
                            if (!temp) {
                                if (this.vars.cancel && this.vars.applied) {
                                    this.vars.applied = false;
                                    this.vars.listeners.attackStart = false;
                                    eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                                    this.vars.listeners.resistStart = false;
                                    eventState.resistStart.splice(eventState.resistStart.indexOf(this), 1);
                                } else if (!this.vars.cancel && !this.vars.applied) {
                                    this.vars.applied = true;
                                    this.vars.listeners.attackStart = true;
                                    eventState.attackStart.push(this);
                                    this.vars.listeners.resistStart = true;
                                    eventState.resistStart.push(this);
                                }
                            }
                        }
                    )
                }
            }
        }
    ],
    secondary: [
        {
            name: "Perfect Shot",
            properties: ["attack", "auto-hit"],
            description: "Makes a non-crit guaranteed hit to a single target",
            code: () => {
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                logAction(`${this.name} shoots a weak mystic arrow.`, "action");
                damage(this, target, [[.5]]);
            }
        },
        {
            name: "Lazing Around",
            properties: ["mana", "debuff", "resource"],
            description: "Reduces speed until next turn then regain mana.",
            code: () => {
                new Modifier("Lazing Around", "Reduces speed and regen mana.",
                    { caster: this, target: this, duration: 1, properties: ["physical", "mana", "debuff", "resource"], stats: { speed: -10 }, listeners: { turnStart: true }, cancel: false, applied: true, focus: false, penalty: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) resourceChange(this.vars.caster, { mana: this.vars.caster.manaRegen * 1.5 });
                            this.vars.duration--;
                        }
                        return this.vars.duration <= 0;
                    },
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
        },
        {
            name: "Lucky Aura",
            properties: ["buff"],
            description: "Increases a random alive ally accuracy/evasion/focus/resist/presence for one of their turns",
            code: () => {
                const target = randTarget(unitFilter(this.team, '', false), 1, true);
                logAction(`${this.name} increased the luck of ${target[0].name}`, "buff")
                basicModifier("Lucky Aura", "Increases accuracy/evasion/focus/resist/presence", { caster: this, target: target[0], duration: 2, properties: ["mystic", "mana", "buff"], stats: { accuracy: 25, evasion: 45, focus: 35, resist: 40, presence: 40 }, listeners: { turnStart: true }, cancel: false, applied: true, focus: false });
            }
        }
    ],
    passive: [
        {
            name: "Unnatural Luck",
            properties: ["mystic", "mana", "buff", "debuff"],
            description: "Reduce max mana by 40 and base mana regen by 8\nRolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has chance to debuff to disadvantage until end of next turn.",
            code: () => {
                this.base.mana -= 40;
                this.base.manaRegen -= 8;
                new Modifier("Unnatural Luck", "Rolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has chance to debuff to disadvantage.",
                    { caster: this, target: this, properties: ["mystic", "mana", "buff", "debuff"], listeners: { attackStart: true, resistStart: true }, cancel: false, applied: true, focus: false },
                    function() {},
                    function(context) {
                        if (context.event === "attackStart" || context.event === "resistStart") {
                            if (context.attacker === this.vars.caster) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                            if (context.defenders.includes(this.vars.caster) && resistDebuff(this.vars.caster, [context.attacker])[0] > 50) for (let i = 0; i < context.defenders.length; i++) if (context.defenders[i] === this.vars.caster) ((context.calcMods.defenders ??= [])[i] ??= { reroll: 0 }).reroll--;
                        }
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                for (const listener in this.vars.listeners) {
                                    this.vars.listeners[listener] = false;
                                    eventState[listener].splice(eventState[listener].indexOf(this), 1);
                                }
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                for (const listener in this.vars.listeners) {
                                    this.vars.listeners[listener] = true;
                                    eventState[listener].push(this);
                                }
                            }
                        }
                    }
                )
            }
        },
        {
            name: "Lazing Around",
            properties: ["mana", "debuff", "resource"],
            description: "Reduce speed and regen mana each turn.",
            code: () => {
                new Modifier("Lazing Around", "Reduces speed and regen mana.",
                    { caster: this, target: this, properties: ["physical", "mana", "debuff", "resource"], stats: { speed: -20 }, listeners: {}, cancel: false, applied: true, focus: false, penalty: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) { if (context.unit === this.vars.caster  && this.vars.applied) resourceChange(this.vars.caster, { mana: this.vars.caster.manaRegen }) },
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
        },
        {
            name: "Rebound Arc",
            properties: ["mystic", "mana", "buff"],
            cost: { mana: 10 },
            description: "Missed attack have a chance to hit a random enemy and non-crit guaranteed hits can make an attack to pierce a random enemy, spend 10 mana after use",
            code: () => {
                new Modifier("Rebound Arc", "Missed attack have a chance to hit a random enemy and non-crit guaranteed hits can make an attack to pierce a random enemy",
                    { caster: this, target: this, properties: ["mystic", "mana", "buff"], listeners: { singleAttack: true, singleDamage: true }, cancel: false, applied: true, focus: false, attacking: false },
                    function() {},
                    function(context) {
                        if (this.vars.attacking || this.vars.caster.mana < 10) return;
                        if (context.event === "singleAttack" && context.attacker === this.vars.caster && context.hitSingle <= 0) {
                            this.vars.attacking = true;
                            let target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                            if (resistDebuff(this.vars.caster, target)[0] > 70) crit(this.vars.caster, target, [[this.accuracy/4]]);
                            resourceChange(this.vars.caster, { mana: -10 });
                        } else if (context.event === "singleDamage" && context.attacker === this.vars.caster && (currentAction.at(-2).properties?.includes("auto-hit") || currentAction.at(-2).vars?.properties?.includes("auto-hit")) && context.critical < 1) {
                            this.vars.attacking = true;
                            attack(this.vars.caster, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 1, context.calcMods)
                            resourceChange(this.vars.caster, { mana: -10 });
                        }
                        this.vars.attacking = false;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.singleAttack = false;
                                eventState.singleAttack.splice(eventState.singleAttack.indexOf(this), 1);
                                this.vars.listeners.singleDamage = false;
                                eventState.singleDamage.splice(eventState.singleDamage.indexOf(this), 1);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.singleAttack = true;
                                eventState.singleAttack.push(this);
                                this.vars.listeners.singleDamage = true;
                                eventState.singleDamage.push(this);
                            }
                        }
                    }
                )
            }
        },
        {
            name: "Lucky Aura",
            properties: ["mystic", "buff"],
            description: "Increases a random alive ally accuracy/evasion/focus/resist/presence for one of their turns",
            code: () => {
                const target = randTarget(unitFilter(this.team, '', false), 1, true);
                logAction(`${this.name} increased the luck of ${target[0].name}`, "buff")
                new Modifier("Lucky Aura", "Increases accuracy/evasion/focus/resist/presence", 
                    { caster: this, target: null, duration: 2, properties: ["mystic", "buff"], stats: { accuracy: 5, evasion: 20, focus: 10, resist: 20, presence: 20 }, listeners: { turnStart: true }, cancel: false, applied: true, focus: false },
                    function() { this.vars.target = randTarget(unitFilter(this.team, '', false).filter(u => u !== this.vars.caster)) },
                    function (context) { if (context.unit === this.vars.caster) this.changeTarget(randTarget(unitFilter(this.team, '', false).filter(u => u !== this.vars.caster), 1, true)) },
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
        },
        {
            name: "Luck Arrow",
            properties: ["mystic", "mana", "buff", "debuff"],
            description: "Reduce max mana by 40 and base mana regen by 8\nOn hit with any attack, chance to give self advantage to next few attacks/debuffs and chance to give disadvantage to target's next few attacks/debuffs",
            code: () => {
                this.base.mana -= 40;
                this.base.manaRegen -= 8;
                new Modifier("Luck Arrow", "On hit with any attack, chance to give self advantage to next few attacks/debuffs and chance to give disadvantage to target's next few attacks/debuffs",
                    { caster: this, target: this, properties: ["mystic", "mana", "buff", "debuff"], listeners: { singleDamage: true }, cancel: false, applied: true, focus: false },
                    function() {},
                    function(context) {
                        if (context.event === "singleDamage") {
                            let mod = modifiers.find(m => m.name === "Luck Arrow buff" && m.vars.caster === this.vars.caster), will = resistDebuff(this.vars.caster, [context.defender]);
                            mod ? (mod.vars.duration += will[0] > 99 ? 7 : Math.ceil(will[0])/25) :
                            new Modifier("Luck Arrow buff", "Gives advantage to next few attacks/debuffs",
                                { caster: this.vars.caster, target: this.vars.caster, duration: will[0] > 99 ? 7 : Math.ceil(will[0]/25), properties: ["mystic", "buff"], listeners: { attackStart: true, resistStart: true }, cancel: false, applied: true, focus: false },
                                function() { return !this.vars.duration },
                                function(context) {
                                    if (this.vars.applied && context.attacker === this.vars.caster) this.vars.duration--, (context.calcMods.all ??= { reroll: 0 }).reroll++;
                                    return this.vars.duration <= 0;
                                },
                                function(cancel, temp) {
                                    if (!temp) {
                                        if (this.vars.cancel && this.vars.applied) {
                                            this.vars.applied = false;
                                            this.vars.listeners.attackStart = false;
                                            eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                                            this.vars.listeners.resistStart = false;
                                            eventState.resistStart.splice(eventState.resistStart.indexOf(this), 1);
                                        } else if (!this.vars.cancel && !this.vars.applied) {
                                            this.vars.applied = true;
                                            this.vars.listeners.attackStart = true;
                                            eventState.attackStart.push(this);
                                            this.vars.listeners.resistStart = true;
                                            eventState.resistStart.push(this);
                                        }
                                    }
                                }
                            );
                            mod = modifiers.find(m => m.name === "Luck Arrow debuff" && m.vars.target === context.defender);
                            will = resistDebuff(this.vars.caster, [context.defender]);
                            mod ? (mod.vars.duration += will[0] > 99 ? 4 : Math.floor(will[0]/33)) :
                            new Modifier("Luck Arrow debuff", "Gives disadvantage to target's next few attacks/debuffs",
                                { caster: this.vars.caster, target: context.defender, duration: will[0] > 99 ? 4 : Math.floor(will[0]/33), properties: ["mystic", "debuff"], listeners: { attackStart: true, resistStart: true }, cancel: false, applied: true, focus: false },
                                function() { return !this.vars.duration },
                                function(context) {
                                    if (this.vars.applied && context.attacker === this.vars.target) this.vars.duration--, context.calcMods.all ? context.calcMods.all.reroll = (context.calcMods.all.reroll || 0) - 1 : context.calcMods.all = { reroll: -1 };
                                    return this.vars.duration <= 0;
                                },
                                function(cancel, temp) {
                                    if (!temp) {
                                        if (this.vars.cancel && this.vars.applied) {
                                            this.vars.applied = false;
                                            this.vars.listeners.attackStart = false;
                                            eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                                            this.vars.listeners.resistStart = false;
                                            eventState.resistStart.splice(eventState.resistStart.indexOf(this), 1);
                                        } else if (!this.vars.cancel && !this.vars.applied) {
                                            this.vars.applied = true;
                                            this.vars.listeners.attackStart = true;
                                            eventState.attackStart.push(this);
                                            this.vars.listeners.resistStart = true;
                                            eventState.resistStart.push(this);
                                        }
                                    }
                                }
                            )
                        }
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.singleDamage = false;
                                eventState.singleDamage.splice(eventState.singleDamage.indexOf(this), 1);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.singleDamage = true;
                                eventState.singleDamage.push(this);
                            }
                        }
                    }
                )
            }
        }
    ],
    augment: [
        {
            name: "Unnatural Luck",
            properties: ["mystic", "mana", "buff", "debuff"],
            cost: { mana: 40 },
            description: "Reduce max mana by 40 and base mana regen by 8\nRolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has chance to debuff to disadvantage until end of next turn.",
            code: () => {
                this.base.mana -= 40;
                this.base.manaRegen -= 8;
                new Modifier("Unnatural Luck", "Rolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has chance to debuff to disadvantage.",
                    { caster: this, target: this, properties: ["mystic", "mana", "buff", "debuff"], listeners: { attackStart: true, resistStart: true }, cancel: false, applied: true, focus: false },
                    function() {},
                    function(context) {
                        if (context.event === "attackStart" || context.event === "resistStart") {
                            if (context.attacker === this.vars.caster) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                            if (context.defenders.includes(this.vars.caster) && resistDebuff(this.vars.caster, [context.attacker])[0] > 25) for (let i = 0; i < context.defenders.length; i++) if (context.defenders[i] === this.vars.caster) ((context.calcMods.defenders ??= [])[i] ??= { reroll: 0 }).reroll--;
                        }
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                for (const listener in this.vars.listeners) {
                                    this.vars.listeners[listener] = false;
                                    eventState[listener].splice(eventState[listener].indexOf(this), 1);
                                }
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                for (const listener in this.vars.listeners) {
                                    this.vars.listeners[listener] = true;
                                    eventState[listener].push(this);
                                }
                            }
                        }
                    }
                )
            }
        },
        {
            name: "Lazing Around",
            properties: ["mana", "debuff", "resource"],
            description: "Reduce speed and regen mana each turn.",
            code: () => {
                new Modifier("Lazing Around", "Reduces speed and regen mana.",
                    { caster: this, target: this, properties: ["physical", "mana", "debuff", "resource"], stats: { speed: -10 }, listeners: {}, cancel: false, applied: true, focus: false, penalty: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) { if (context.unit === this.vars.caster && this.vars.applied) resourceChange(this.vars.caster, { mana: this.vars.caster.manaRegen * 1.5 }) },
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
        },
        {
            name: "Lucky Aura",
            properties: ["mana", "buff"],
            description: "Increases a random alive ally accuracy/evasion/focus/resist/presence for one turn",
            code: () => {
                const target = randTarget(unitFilter(this.team, '', false), 1, true);
                logAction(`${this.name} increased the luck of ${target[0].name}`, "buff")
                new Modifier("Lucky Aura", "Increases accuracy/evasion/focus/resist/presence", 
                    { caster: this, target: null, duration: 2, properties: ["mystic", "buff"], stats: { accuracy: 25, evasion: 45, focus: 35, resist: 40, presence: 40 }, listeners: { turnStart: true }, cancel: false, applied: true, focus: false },
                    function() { this.vars.target = randTarget(unitFilter(this.team, '', false).filter(u => u !== this.vars.caster)) },
                    function (context) { if (context.unit === this.vars.caster) this.changeTarget(randTarget(unitFilter(this.team, '', false).filter(u => u !== this.vars.caster), 1, true)) },
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
        },
        {
            name: "Luck Arrow",
            properties: ["mystic", "mana", "buff", "debuff"],
            cost: { mana: 40 },
            description: "Reduce max mana by 40 and base mana regen by 8\nOn hit with any attack, gives self advantage to next few attacks/debuffs depending on chance and chance to give disadvantage to target's next few attacks/debuffs, 1% chance to fail to give advantage",
            code: () => {
                this.base.mana -= 40;
                this.base.manaRegen -= 8;
                new Modifier("Luck Arrow", "On hit with any attack, gives self advantage to next few attacks/debuffs depending on chance and chance to give disadvantage to target's next few attacks/debuffs, 1% chance to fail to give advantage",
                    { caster: this, target: this, properties: ["mystic", "mana", "buff", "debuff"], listeners: { singleDamage: true }, cancel: false, applied: true, focus: false },
                    function() {},
                    function(context) {
                        if (context.event === "singleDamage") {
                            let mod = modifiers.find(m => m.name === "Luck Arrow buff" && m.vars.caster === this.vars.caster), will = resistDebuff(this.vars.caster, [context.defender]);
                            mod ? (mod.vars.duration += will[0] < 2 ? 0 : will[0] > 99 ? 7 : Math.floor(will[0]/33) + 1) :
                            new Modifier("Luck Arrow buff", "Gives advantage to next few attacks/debuffs",
                                { caster: this.vars.caster, target: this.vars.caster, duration: 0, properties: ["mystic", "buff"], listeners: { attackStart: true, resistStart: true }, cancel: false, applied: true, focus: false },
                                function() {
                                    let will = resistDebuff(this.vars.caster, [this.vars.target]);
                                    this.vars.duration = will[0] < 2 ? 0 : will[0] > 99 ? 7 : Math.floor(will[0]/33) + 1;
                                    return !this.vars.duration;
                                },
                                function(context) {
                                    if (!this.vars.applied) return;
                                    if (context.attacker === this.vars.caster) this.vars.duration--, (context.calcMods.all ??= { reroll: 0 }).reroll++;
                                    return this.vars.duration <= 0;
                                },
                                function(cancel, temp) {
                                    if (!temp) {
                                        if (this.vars.cancel && this.vars.applied) {
                                            this.vars.applied = false;
                                            this.vars.listeners.attackStart = false;
                                            eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                                            this.vars.listeners.resistStart = false;
                                            eventState.resistStart.splice(eventState.resistStart.indexOf(this), 1);
                                        } else if (!this.vars.cancel && !this.vars.applied) {
                                            this.vars.applied = true;
                                            this.vars.listeners.attackStart = true;
                                            eventState.attackStart.push(this);
                                            this.vars.listeners.resistStart = true;
                                            eventState.resistStart.push(this);
                                        }
                                    }
                                }
                            );
                            mod = modifiers.find(m => m.name === "Luck Arrow debuff" && m.vars.target === context.defender);
                            will = resistDebuff(this.vars.caster, [context.defender]);
                            mod ? (mod.vars.duration += will[0] > 99 ? 7 : Math.floor(will[0]/25)) :
                            new Modifier("Luck Arrow debuff", "Gives disadvantage to target's next few attacks/debuffs",
                                { caster: this.vars.caster, target: context.defender, duration: will[0] > 99 ? 7 : Math.floor(will[0]/25), properties: ["mystic", "debuff"], listeners: { attackStart: true, resistStart: true }, cancel: false, applied: true, focus: false },
                                function() { return !this.vars.duration },
                                function(context) {
                                    if (this.vars.applied && context.attacker === this.vars.target) this.vars.duration--, context.calcMods.all ? context.calcMods.all.reroll = (context.calcMods.all.reroll || 0) - 1 : context.calcMods.all = { reroll: -1 };
                                    return this.vars.duration <= 0;
                                },
                                function(cancel, temp) {
                                    if (!temp) {
                                        if (this.vars.cancel && this.vars.applied) {
                                            this.vars.applied = false;
                                            this.vars.listeners.attackStart = false;
                                            eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                                            this.vars.listeners.resistStart = false;
                                            eventState.resistStart.splice(eventState.resistStart.indexOf(this), 1);
                                        } else if (!this.vars.cancel && !this.vars.applied) {
                                            this.vars.applied = true;
                                            this.vars.listeners.attackStart = true;
                                            eventState.attackStart.push(this);
                                            this.vars.listeners.resistStart = true;
                                            eventState.resistStart.push(this);
                                        }
                                    }
                                }
                            )
                        }
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.singleDamage = false;
                                eventState.singleDamage.splice(eventState.singleDamage.indexOf(this), 1);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.singleDamage = true;
                                eventState.singleDamage.push(this);
                            }
                        }
                    }
                )
            }
        }
    ]
}