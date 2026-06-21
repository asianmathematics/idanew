import { attack, basicModifier, eventState, logAction, Modifier, randTarget, resistDebuff, unitFilter } from '../combatDictionary.js';
import { Unit } from './unit.js';

export const Silhouette = new Unit("Silhouette", [650, 24, 25, 110, 160, 135, 140, 75, 50, "mid", 60, 80, 6, 100, 8]);

const skills = {
    special: [
        {
            name: "Shadow Blade",
            properties: ["physical", "stamina", "mystic", "mana", "attack"],
            cost: { stamina: 10, mana: 20, position: "front" },
            description: "Cost 10 stamina & 20 mana, frontline only\nMakes 4 attacks at a single target with increased accuracy and damage",
            target: () => this.stamina < 10 || this.mana < 20 ? showMessage("Not enough resources!", "error", "selection") : this.team === "player" ? selectTarget(this.actions.special, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.special.code(randTarget(unitFilter("player", "front", false))),
            code: (target) => {
                [this.previousAction[0], this.previousAction[1]] = [true, true];
                this.stamina -= 10;
                this.mana -= 20;
                logAction(`${this.name} strike at the heart of ${target[0].name}!`, "action");
                attack(this, target, 4, { attacker: { damage: this.damage + 18, accuracy: this.accuracy + 50 } })
            }
        },
        {
            name: "Fear of the Dark",
            properties: ["physical", "stamina", "mystic", "mana", "buff", "debuff", "positional"],
            cost: { stamina: 15, mana: 25 },
            description: "Cost 15 stamina & 25 mana\nIncreases evasion/focus/presence, gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, lasts 4 turns, 1% chance to fail to give advantage or decrease stats",
            code: () => {
                if (this.stamina < 15 || this.mana < 25) return showMessage("Not enough resources!", "error", "selection");
                [this.previousAction[0], this.previousAction[1]] = [true, true];
                this.stamina -= 15;
                this.mana -= 25;
                basicModifier("Fear of the Dark buff", "Increases evasion/focus/presence", { caster: this, target: this, duration: 5, properties: ["physical", "stamina", "mystic", "mana", "buff"], stats: { evasion: 40, focus: 20, presence: 40 }, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true });
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, 1% chance to fail",
                    { caster: this, target: this, duration: 5, properties: ["physical", "stamina", "mystic", "mana", "buff", "debuff"], listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancel: false, applied: true, focus: true },
                    function() { },
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders.includes(this.vars.caster) && resistDebuff(this.vars.caster, context.attacker)[0] >= 2) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: context.calcMods?.attacker?.accuracy - 40 || context.attacker.accuracy - 40 } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: context.calcMods?.attacker?.focus - 40 || context.attacker.focus - 40 };
                        else if (context.attacker === this.vars.caster) for (const defender in context.defender) if (resistDebuff(this.vars.caster, context.defender)[0] >= 2) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                        if (context.unit === this.vars.caster) this.vars.duration--;
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
        {
            name: "Summon Shadow",
            properties: ["mystic", "mana", "summon", "positional"],
            cost: { mana: 60 },
            description: "Cost 60 mana\nSummon shadow clone of a ally unit in the same position with 1 star stats for 6 turns",
            target: () => this.mana < 60 ? showMessage("Not enough mana!", "error", "selection") : this.team === "player" ? selectTarget(this.actions.special, () => { playerTurn(this) }, [1, true, unitFilter("player", this.position)]) : this.actions.special.code(randTarget(unitFilter("enemy", this.position))),
            code: (target) => {
                this.previousAction[1] =  true;
                this.mana -= 60;
                const clone = cloneUnit(target);
                for (const stat in clone.base.filter(s => s !== "position" && s !== "elements" )) clone.base[stat] = Math.ceil(clone.base[stat] * 4 / 9);
                new Modifier("Summon Shadow", "Summon shadow clone of a ally unit in the same position with 1 star stats",
                    { caster: this, target: this, duration: 5, properties: ["physical", "stamina", "mystic", "mana", "buff", "debuff"], listeners: { turnEnd: true, modifierEnd: true }, cancel: false, applied: true, focus: false },
                )
            }
        }
    ],
    basic: [
        {
            name: "Shadow Blade",
            properties: ["physical", "mystic", "attack"],
            cost: { position: "front" },
            description: "Frontline only\nMakes 2 attacks at a single target with increased accuracy and damage",
            code: () => {
                [this.previousAction[0], this.previousAction[1]] = [true, true];
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                logAction(`${this.name} strikes ${target[0].name}!`, "action");
                attack(this, target, 2, { attacker: { damage: this.damage + 18, accuracy: this.accuracy + 50 } })
            }
        }
    ],
    secondary: [
        {
            name: "Shadow Blade",
            properties: ["attack"],
            cost: { position: "front" },
            description: "Frontline only\nAttacks a single target with increased accuracy and damage",
            code: () => {
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                logAction(`${this.name} strikes ${target[0].name}!`, "action");
                attack(this, target, 1, { attacker: { damage: this.damage + 18, accuracy: this.accuracy + 50 } })
            }
        },
        {
            name: "Fear of the Dark",
            properties: ["buff", "debuff", "positional"],
            description: "Increases evasion/focus/presence, chance to gives advantage to attacks at frontline, chance to decreases enemy accuracy or focus of attacks/debuff to self at the backline, until end of next turn",
            code: () => {
                basicModifier("Fear of the Dark buff", "Increases evasion/focus/presence", { caster: this, target: this, duration: 2, properties: ["physical", "mystic", "buff"], stats: { evasion: 20, focus: 10, presence: 20 }, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true });
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, 1% chance to fail",
                    { caster: this, target: this, duration: 2, properties: ["physical", "mystic", "buff", "debuff"], listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancel: false, applied: true, focus: true },
                    function() { },
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders.includes(this.vars.caster) && resistDebuff(this.vars.caster, context.attacker)[0] > 24) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: context.calcMods?.attacker?.accuracy - 40 || context.attacker.accuracy - 40 } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: context.calcMods?.attacker?.focus - 40 || context.attacker.focus - 40 };
                        else if (context.attacker === this.vars.caster) for (const defender in context.defender) if (resistDebuff(this.vars.caster, context.defender)[0] > 24) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                        if (context.unit === this.vars.caster) this.vars.duration--;
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
    passive: [
        {
            name: "Fear of the Dark",
            properties: ["buff", "debuff", "positional"],
            description: "Reduces stamina regen by 1 and mana regen by 2\nIncreases evasion/focus/presence, chance to gives advantage to attacks at frontline, chance to decreases enemy accuracy or focus of attacks/debuff to self at the backline",
            code: () => {
                this.base.staminaRegen--;
                this.base.manaRegen -= 2;
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, 1% chance to fail",
                    { caster: this, target: this, properties: ["physical", "mystic", "buff", "debuff"], stats: { evasion: 20, focus: 10, presence: 20 }, listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancel: false, applied: true, focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders.includes(this.vars.caster) && resistDebuff(this.vars.caster, context.attacker)[0] > 33) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: context.calcMods?.attacker?.accuracy - 40 || context.attacker.accuracy - 40 } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: context.calcMods?.attacker?.focus - 40 || context.attacker.focus - 40 };
                        else if (context.attacker === this.vars.caster) for (const defender in context.defender) if (resistDebuff(this.vars.caster, context.defender)[0] > 33) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                    }
                ),
                function() {
                    if (this.vars.cancel && this.vars.applied) {
                        resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false)
                        this.vars.applied = false;
                        this.vars.listeners.attackStart = false;
                        eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                        this.vars.listeners.resistStart = false;
                        eventState.resistStart.splice(eventState.resistStart.indexOf(this), 1);
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats))
                        this.vars.applied = true;
                        this.vars.listeners.attackStart = true;
                        eventState.attackStart.push(this);
                        this.vars.listeners.resistStart = true;
                        eventState.resistStart.push(this);
                    }
                }
            }
        }
    ],
    augment: [
        {
            name: "Fear of the Dark",
            properties: ["buff", "debuff", "positional"],
            description: "Reduces stamina regen by 1 and mana regen by 2\nIncreases evasion/focus/presence, chance to gives advantage to attacks at frontline, chance to decreases enemy accuracy or focus of attacks/debuff to self at the backline",
            code: () => {
                this.base.staminaRegen--;
                this.base.manaRegen -= 2;
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, 1% chance to fail",
                    { caster: this, target: this, properties: ["physical", "mystic", "buff", "debuff"], stats: { evasion: 30, focus: 15, presence: 30 }, listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancel: false, applied: true, focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders.includes(this.vars.caster) && resistDebuff(this.vars.caster, context.attacker)[0] > 24) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: context.calcMods?.attacker?.accuracy - 40 || context.attacker.accuracy - 40 } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: context.calcMods?.attacker?.focus - 40 || context.attacker.focus - 40 };
                        else if (context.attacker === this.vars.caster) for (const defender in context.defender) if (resistDebuff(this.vars.caster, context.defender)[0] > 24) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                    }
                ),
                function() {
                    if (this.vars.cancel && this.vars.applied) {
                        resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false)
                        this.vars.applied = false;
                        this.vars.listeners.attackStart = false;
                        eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                        this.vars.listeners.resistStart = false;
                        eventState.resistStart.splice(eventState.resistStart.indexOf(this), 1);
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats))
                        this.vars.applied = true;
                        this.vars.listeners.attackStart = true;
                        eventState.attackStart.push(this);
                        this.vars.listeners.resistStart = true;
                        eventState.resistStart.push(this);
                    }
                }
            }
        }
    ]
}