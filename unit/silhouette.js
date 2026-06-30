import { allUnits, attack, basicModifier, eventState, logAction, Modifier, modifiers, randTarget, removeModifier, resistDebuff, unitFilter } from '../combatDictionary.js';
import { Unit, createUnit, cloneUnit } from './unit.js';

export const Silhouette = new Unit("Silhouette", [650, 24, 25, 110, 160, 135, 140, 75, 50, "mid", 80, 80, 10, 100, 16]);

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
                basicModifier("Fear of the Dark buff", "Increases evasion/focus/presence", { caster: this, target: this, duration: 5, properties: ["physical", "mystic", "buff"], stats: { evasion: 40, focus: 20, presence: 40 }, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true });
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, 1% chance to fail",
                    { caster: this, target: this, duration: 5, properties: ["physical", "mystic", "buff", "debuff", "positional"], listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancel: false, applied: true, focus: true },
                    function() { },
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders.includes(this.vars.caster) && resistDebuff(this.vars.caster, context.attacker)[0] >= 2) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: context.calcMods?.attacker?.accuracy - 40 || context.attacker.accuracy - 40 } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: context.calcMods?.attacker?.focus - 40 || context.attacker.focus - 40 };
                        else if (context.attacker === this.vars.caster) for (const defender of context.defenders) if (resistDebuff(this.vars.caster, defender)[0] >= 2) (context.calcMods.all ??= { reroll: 0 }).reroll++;
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
                logAction(`${this.name} creates a shadow clone of ${target.name}!`, "action");
                const clone = cloneUnit(target).custom = { summoner: this };
                for (const stat in clone.base.filter(s => s !== "position" && s !== "elements" )) clone.base[stat] = Math.ceil(clone.base[stat] * 4 / 9);
                clone.base.hp = Math.ceil(clone.base.hp/10);
                resetStat(clone, Object.keys(clone.base).filter(s => s !== "position" && s !== "elements" ));
                if (eventState.unitChange.length) handleEvent('unitChange', { type: 'summon', unit: clone})
                new Modifier("Summon Shadow", "Summon shadow clone of a ally unit in the same position with 1 star stats",
                    { caster: this, target: clone, duration: 6, properties: ["mystic", "summon"], listeners: { turnEnd: true }, cancel: false, applied: true, focus: false, perm: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.target) this.vars.duration--;
                        if (this.vars.duration <= 0) {
                            allUnits.splice(this.vars.target, 1);
                            if (eventState.unitChange.length) handleEvent('unitChange', { type: 'unsummon', unit: this.vars.target})
                            for (const mod of modifiers) if (mod.vars.caster === this.vars.caster) removeModifier(mod);
                            return true;
                        }
                    },
                    function() {}
                )
            }
        },
        {
            name: "Friends with the Shadows",
            properties: ["mystic", "mana", "buff"],
            cost: { mana: 40 },
            description: "Cost 40 mana\nShadow summons gain a star up equivalent stat increase, except for hp and resources, also gains the Fear of the Dark buff if active, lasts 4 turns",
            code: () => {
                if (this.mana < 40) return showMessage("Not enough mana!", "error", "selection");
                this.previousAction[1] = true;
                this.mana -= 40;
                logAction(`${this.name} supports the shadows!`, "buff");
                new Modifier("Friends with the Shadows", "Shadow summons gain a star up equivalent stat increase, except for hp and resources, also gains the Fear of the Dark buff if active",
                    { caster: this, targets: this, duration: 4, properties: ["mystic", "buff"], listeners: { turnStart: true, unitChange: true, modifierStart: true, modifierEnd: true }, cancel: false, applied: true, focus: true},
                    function() {
                        const mod = modifiers.find(m => m.name === "Fear of the Dark" && m.vars.caster === this.vars.caster);
                        if (mod.vars?.passive) delete this.vars.modifierStart, delete this.vars.modifierEnd;
                        for (const target of this.vars.targets) {
                            if (mod) new Modifier(mod.name + " copy", mod.description, { ...mod.vars, target: target, stats: { ...mod.vars.stats }, listeners: {}, cancel: false, applied: true }, mod.init, mod.onTurn, mod.cancel, mod.changeTarget);
                            basicModifier("Friends with the Shadows buff", "Star up equivalent stat increase", { caster: this.vars.caster, target: target, properties: ["mystic", "mana", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, target.base[k] * 1.5])), cancel: false, applied: true, focus: false})
                        }
                    },
                    function(context) {
                        if (this.vars.applied) {
                            if (context.type === 'summon' && context.unit.custom?.summoner === this.vars.caster) this.changeTarget([], [context.unit])
                            else if (context.type === 'unsummon' && context.unit.custom?.summoner === this.vars.caster) this.changeTarget([context.unit]);
                            else if (context.event === 'modifierStart' && context.modifier.name === "Fear of the Dark" && context.modifier.vars.target === this.vars.caster) for (const target of this.vars.targets) new Modifier(context.modifier.name + " copy", context.modifier.description, { ...context.modifier.vars, target: target, listeners: {}, cancel: false, applied: true }, context.modifier.init, context.modifier.onTurn, context.modifier.cancel, context.modifier.changeTarget);
                            else if (context.event === 'modifierEnd' && context.modifier.name === "Fear of the Dark" && context.modifier.vars.target === this.vars.caster) for (const target of this.vars.targets) removeModifier(modifiers.find(m => m.name === "Fear of the Dark copy" && m.vars.target === target));
                        }
                        if (context.event === 'turnStart' && context.unit === this.vars.caster) this.vars.duration--
                        return this.vars.duration <= 0;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                modifiers.filter(m => this.vars.target.includes(m.vars.target) && m.vars.caster === this.vars.caster).forEach(m => removeModifier(m))
                                this.vars.applied = false;
                                for (const listener in this.vars.listeners) {
                                    if (listener === "turnStart") continue;
                                    this.vars.listeners[listener] = false;
                                    eventState[listener].splice(eventState[listener].indexOf(this), 1);
                                }
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                const mod = modifiers.find(m => m.name === "Fear of the Dark" && m.vars.caster === this.vars.caster);
                                for (const target of this.vars.targets) {
                                    if (mod) new Modifier(mod.name + " copy", mod.description, { ...mod.vars, target: target, stats: { ...mod.vars.stats }, listeners: {}, cancel: false, applied: true }, mod.init, mod.onTurn, mod.cancel, mod.changeTarget);
                                    basicModifier("Friends with the Shadows buff", "Star up equivalent stat increase", { caster: this.vars.caster, target: target, properties: ["mystic", "mana", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, target.base[k] * 1.5])), cancel: false, applied: true, focus: false})
                                }
                                this.vars.applied = true;
                                for (const listener in this.vars.listeners) {
                                    if (listener === "turnStart") continue;
                                    this.vars.listeners[listener] = true;
                                    eventState[listener].push(this);
                                }
                            }
                        }
                    },
                    function(remove = [], add = []) {
                        if (remove.length - add.length >= this.vars.targets.length) removeModifier(this);
                        else {
                            if (this.vars.applied) {
                                modifiers.filter(m => remove.includes(m.vars.target) && m.vars.caster === this.vars.caster).forEach(m => removeModifier(m))
                                for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                                this.vars.targets.push(...add);
                                const mod = modifiers.find(m => m.name === "Fear of the Dark" && m.vars.caster === this.vars.caster);
                                for (const target of this.vars.targets) {
                                    if (mod) new Modifier(mod.name + " copy", mod.description, { ...mod.vars, target: target, stats: { ...mod.vars.stats }, listeners: {}, cancel: false, applied: true }, mod.init, mod.onTurn, mod.cancel, mod.changeTarget);
                                    basicModifier("Friends with the Shadows buff", "Star up equivalent stat increase", { caster: this.vars.caster, target: target, properties: ["mystic", "mana", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, target.base[k] * 1.5])), cancel: false, applied: true, focus: false})
                                }
                            } else {
                                for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                                this.vars.targets.push(...add);
                            }
                        }
                    }
                )
            }
        },
        {
            name: "Amulet of Darkness",
            properties: ["physical", "stamina", "mana"],
            cost: { stamina: 40, position: 'back' },
            description: `Cost 40 stamina, backline only\nHeals a lot (${this.healFactor * 2} HP) and regen some mana`,
            code: () => {
                if (this.stamina < 40) return showMessage("Not enough stamina!", "error", "selection");
                this.previousAction[0] = true;
                this.stamina -= 40;
                logAction(`${this.name}'s amulet radiates with power!`, "heal");
                heal(this, [this], [this.healFactor * 2]);
                resourceChange(this, { mana: this.manaRegen });
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
        },
        {
            name: "Summon Shadow",
            properties: ["mystic", "mana", "summon", "positional"],
            cost: { mana: 20 },
            description: "Cost 20 mana\nSummons a 1 star shadow for 4 turns",
            target: () => this.mana < 20 ? showMessage("Not enough mana!", "error", "selection") : this.team === "player" ? selectTarget(this.actions.special, () => { playerTurn(this) }, [1, true, unitFilter("player", this.position)]) : this.actions.special.code(randTarget(unitFilter("enemy", this.position))),
            code: (target) => {
                this.previousAction[1] =  true;
                this.mana -= 20;
                logAction(`${this.name} creates a shadow.`, "action");
                const clone = createUnit(new Unit("Shadow", [290, 13, 11, 49, 66, 60, 60, 30, 24, this.position, 16, 10, 1, 40, 8]));
                if (eventState.unitChange.length) handleEvent('unitChange', { type: 'summon', unit: clone})
                new Modifier("Summon Shadow", "Summon shadow clone of a ally unit in the same position with 1 star stats",
                    { caster: this, target: clone, duration: 6, properties: ["mystic", "summon"], listeners: { turnEnd: true }, cancel: false, applied: true, focus: false, perm: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.target) this.vars.duration--;
                        if (this.vars.duration <= 0) {
                            allUnits.splice(this.vars.target, 1);
                            if (eventState.unitChange.length) handleEvent('unitChange', { type: 'unsummon', unit: this.vars.target})
                            for (const mod of modifiers) if (mod.vars.caster === this.vars.caster) removeModifier(mod);
                            return true;
                        }
                    },
                    function() {}
                )
            }
        },
        {
            name: "Amulet of Darkness",
            properties: ["physical", "stamina", "mana"],
            cost: { stamina: 20, position: 'back' },
            description: `Cost 20 stamina, backline only\nHeals moderately (${this.healFactor} HP) and regen some mana`,
            code: () => {
                if (this.stamina < 20) return showMessage("Not enough stamina!", "error", "selection");
                this.previousAction[0] = true;
                this.stamina -= 20;
                logAction(`${this.name}'s amulet radiates with power!`, "heal");
                heal(this, [this], [this.healFactor]);
                resourceChange(this, { mana: this.manaRegen/2 });
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
                const mod = modifiers.filter(m => m.name === "Fear of the Dark" && m.vars.caster === this);
                mod.length ? mod.forEach(m => m.vars.duration++) :
                basicModifier("Fear of the Dark buff", "Increases evasion/focus/presence", { caster: this, target: this, duration: 2, properties: ["physical", "mystic", "buff"], stats: { evasion: 20, focus: 10, presence: 20 }, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true }),
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, 1% chance to fail",
                    { caster: this, target: this, duration: 2, properties: ["physical", "mystic", "buff", "debuff", "positional"], listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancel: false, applied: true, focus: true },
                    function() {},
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders.includes(this.vars.caster) && resistDebuff(this.vars.caster, context.attacker)[0] > 24) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: context.calcMods?.attacker?.accuracy - 40 || context.attacker.accuracy - 40 } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: context.calcMods?.attacker?.focus - 40 || context.attacker.focus - 40 };
                        else if (context.attacker === this.vars.caster) for (const defender of context.defenders) if (resistDebuff(this.vars.caster, defender)[0] > 24) (context.calcMods.all ??= { reroll: 0 }).reroll++;
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
            name: "Amulet of Darkness",
            properties: ["physical", "stamina", "mana"],
            cost: { position: 'back' },
            description: `Cost 40 stamina, backline only\nHeals a bit (${this.healFactor/2} HP) and regen some mana`,
            code: () => {
                if (this.stamina < 40) return showMessage("Not enough stamina!", "error", "selection");
                this.previousAction[0] = true;
                this.stamina -= 40;
                logAction(`${this.name}'s amulet radiates with power!`, "heal");
                heal(this, [this], [this.healFactor/2]);
                resourceChange(this, { mana: this.manaRegen/4 });
            }
        },
        {
            name: "Accursed Linage",
            properties: ["physical", "stamina", "mystic", "mana", "revive"],
            cost: { stamina: 15, mana: 25 },
            description: `Cost 15 stamina and 25 mana\nRevives once within the next 6 turns`,
            code: () => {
                if (this.stamina < 15 || this.mana < 25) return showMessage("Not enough resources!", "error", "selection");
                this.stamina -= 50;
                this.previousAction[0] = true;
                new Modifier("But It Refused", `Revives once per turn`,
                    { caster: this, target: this, duration: 5, properties: ["physical", "mystic", "revive"], listeners: { turnStart: true, unitChange: true }, cancel: false, applied: true, focus: false },
                    function() {},
                    function(context) {
                        if (this.vars.listeners.unitChange && context.unit === this.vars.target && context.type === "downed") {
                            heal(this.vars.caster, [this.vars.target], [4 * this.healFactor]);
                            if (eventState.unitChange.length) handleEvent('unitChange', {type: 'revive', unit: this.vars.target});
                            logAction(`${this.vars.target.name} refused to die and healed${this.vars.target.team === "player" ? ` ${3 * this.vars.target.healFactor} HP` : ''}!`, "buff");
                            return true
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
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline",
                    { caster: this, target: this, properties: ["physical", "mystic", "buff", "debuff", "positional"], stats: { evasion: 20, focus: 10, presence: 20 }, listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancel: false, applied: true, focus: true, passive: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders.includes(this.vars.caster) && resistDebuff(this.vars.caster, context.attacker)[0] > 33) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: context.calcMods?.attacker?.accuracy - 40 || context.attacker.accuracy - 40 } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: context.calcMods?.attacker?.focus - 40 || context.attacker.focus - 40 };
                        else if (context.attacker === this.vars.caster) for (const defender in context.defenders) if (resistDebuff(this.vars.caster, defender)[0] > 33) (context.calcMods.all ??= { reroll: 0 }).reroll++;
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
        },
        {
            name: "Friends with the Shadows",
            properties: ["mystic", "mana", "buff"],
            description: "Reduces max mana by 40\nShadow summons get star up equivelant stats",
            code: () => {
                this.base.mana -= 40;
                new Modifier("Friends with the Shadows", "Shadow summons get star up equivelant stats",
                    { caster: this, targets: [], properties: ["mystic", "buff"], listeners: { unitChange: true }, cancel: false, applied: true, focus: true, passive: true },
                    function() {},
                    function(context) {
                        if (context.unit.custom?.summoner !== this.vars.caster) return;
                        if (context.type === 'summon') this.changeTarget([], [context.unit]);
                        else if (context.type === 'unsummon') this.changeTarget([context.unit], []);
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                modifiers.filter(m => this.vars.target.includes(m.vars.target) && m.vars.caster === this.vars.caster).forEach(m => removeModifier(m))
                                this.vars.applied = false;
                                for (const listener in this.vars.listeners) {
                                    if (listener === "turnStart") continue;
                                    this.vars.listeners[listener] = false;
                                    eventState[listener].splice(eventState[listener].indexOf(this), 1);
                                }
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                for (const target of this.vars.targets) basicModifier("Friends with the Shadows buff", "Star up equivalent stat increase", { caster: this.vars.caster, target: target, properties: ["mystic", "mana", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, target.base[k] * 1.5])), cancel: false, applied: true, focus: false})
                                this.vars.applied = true;
                                for (const listener in this.vars.listeners) {
                                    if (listener === "turnStart") continue;
                                    this.vars.listeners[listener] = true;
                                    eventState[listener].push(this);
                                }
                            }
                        }
                    },
                    function(remove = [], add = []) {
                        if (remove.length - add.length >= this.vars.targets.length) removeModifier(this);
                        else {
                            if (this.vars.applied) {
                                modifiers.filter(m => remove.includes(m.vars.target) && m.vars.caster === this.vars.caster).forEach(m => removeModifier(m))
                                for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                                this.vars.targets.push(...add);
                                for (const target of this.vars.targets) basicModifier("Friends with the Shadows buff", "Star up equivalent stat increase", { caster: this.vars.caster, target: target, properties: ["mystic", "mana", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, target.base[k] * 1.5])), cancel: false, applied: true, focus: false})
                            } else {
                                for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                                this.vars.targets.push(...add);
                            }
                        }
                    }
                )
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
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline",
                    { caster: this, target: this, properties: ["physical", "mystic", "buff", "debuff", "positional"], stats: { evasion: 30, focus: 15, presence: 30 }, listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancel: false, applied: true, focus: true, passive: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders.includes(this.vars.caster) && resistDebuff(this.vars.caster, context.attacker)[0] > 24) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: context.calcMods?.attacker?.accuracy - 40 || context.attacker.accuracy - 40 } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: context.calcMods?.attacker?.focus - 40 || context.attacker.focus - 40 };
                        else if (context.attacker === this.vars.caster) for (const defender in context.defenders) if (resistDebuff(this.vars.caster, defender)[0] > 24) (context.calcMods.all ??= { reroll: 0 }).reroll++;
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
        },
        {
            name: "Friends with the Shadows",
            properties: ["mystic", "mana", "buff"],
            description: "Reduces max mana by 30\nShadow summons get star up equivelant stats",
            code: () => {
                this.base.mana -= 30;
                new Modifier("Friends with the Shadows", "Shadow summons get star up equivelant stats",
                    { caster: this, targets: [], properties: ["mystic", "buff"], listeners: { unitChange: true }, cancel: false, applied: true, focus: true, passive: true },
                    function() {},
                    function(context) {
                        if (context.unit.custom?.summoner !== this.vars.caster) return;
                        if (context.type === 'summon') this.changeTarget([], [context.unit]);
                        else if (context.type === 'unsummon') this.changeTarget([context.unit], []);
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                modifiers.filter(m => this.vars.target.includes(m.vars.target) && m.vars.caster === this.vars.caster).forEach(m => removeModifier(m))
                                this.vars.applied = false;
                                for (const listener in this.vars.listeners) {
                                    if (listener === "turnStart") continue;
                                    this.vars.listeners[listener] = false;
                                    eventState[listener].splice(eventState[listener].indexOf(this), 1);
                                }
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                for (const target of this.vars.targets) basicModifier("Friends with the Shadows buff", "Star up equivalent stat increase", { caster: this.vars.caster, target: target, properties: ["mystic", "mana", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, target.base[k] * 1.5])), cancel: false, applied: true, focus: false})
                                this.vars.applied = true;
                                for (const listener in this.vars.listeners) {
                                    if (listener === "turnStart") continue;
                                    this.vars.listeners[listener] = true;
                                    eventState[listener].push(this);
                                }
                            }
                        }
                    },
                    function(remove = [], add = []) {
                        if (remove.length - add.length >= this.vars.targets.length) removeModifier(this);
                        else {
                            if (this.vars.applied) {
                                modifiers.filter(m => remove.includes(m.vars.target) && m.vars.caster === this.vars.caster).forEach(m => removeModifier(m))
                                for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                                this.vars.targets.push(...add);
                                for (const target of this.vars.targets) basicModifier("Friends with the Shadows buff", "Star up equivalent stat increase", { caster: this.vars.caster, target: target, properties: ["mystic", "mana", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, target.base[k] * 1.5])), cancel: false, applied: true, focus: false})
                            } else {
                                for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                                this.vars.targets.push(...add);
                            }
                        }
                    }
                )
            }
        }
    ]
}