import { sleep, unitFilter, Modifier, handleEvent, removeModifier, basicModifier, stunModifier, attribCancelMod, logAction, resetStat, regenerateResources, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, modifiers, currentAction, elements, eventState } from '../combatDictionary.js';
import { Unit, createUnit, cloneUnit, allUnits } from './unit.js';

export const Silhouette = new Unit("Silhouette", [650, 24, 25, 110, 160, 135, 140, 75, 50, "mid", 80, 80, 10, 100, 16], ["independence/loneliness"]);

Silhouette.description = "3-star physical mystic unit with high hit/resist from attacks/crit/debuffs but low defensive stats and speed, can summon shadows.";

Silhouette.skills = {
    special: [
        {
            name: "Shadow Blade",
            properties: ["physical", "stamina", "mystic", "mana", "attack"],
            cost: { stamina: 10, mana: 20, position: "front" },
            description: "Makes 4 attacks at a single target with increased accuracy and attack",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front", false))) },
            code(target) { attack(this, target, 4, { attacker: { attack: { bonus: 36 }, accuracy: { bonus: 50 } } }) }
        },
        {
            name: "Ball of Darkness",
            properties: ["physical", "stamina", "mystic", "mana", "attack", "multi-target"],
            cost: { stamina: 10, mana: 20, position: "back" },
            description: "Makes an attack at a single target with double accuracy. On hit, randomly targets another enemy with the attack and continues until miss",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front", false))) },
            code(target) {
                let hit = attack(this, target, 1, { attacker: { accuracy: { mult: 2 } } }), t = target;
                while (hit[0] > 0) {
                    let list = unitFilter(this.team === "player" ? "enemy" : "player", "front", false).filter(u => u !== t[0]);
                    if (!list.length) break;
                    hit = attack(this, t = randTarget(list, 1, true), 1, { attacker: { accuracy: { mult: 2 } } });
                }
            }
        },
        {
            name: "Fear of the Dark",
            properties: ["physical", "stamina", "mystic", "mana", "buff", "debuff", "positional"],
            cost: { stamina: 15, mana: 25 },
            description: "Increases evasion/focus/presence, gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, lasts 4 turns, 1% chance to fail to give advantage or decrease stats",
            code() {
                basicModifier("Fear of the Dark buff", "Increases evasion/focus/presence", { caster: this, target: this, duration: 5, properties: ["physical", "mystic", "buff"], stats: { evasion: 40, focus: 20, presence: 40 }, listeners: { turnEnd: true }, focus: true });
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, 1% chance to fail",
                    { caster: this, target: this, duration: 5, properties: ["physical", "mystic", "buff", "debuff", "positional"], listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], focus: true, debuffing: 0 },
                    function() {},
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders?.includes(this.vars.caster) && !this.vars.debuffing++ && resistDebuff(this.vars.caster, [context.attacker])[this.vars.debuffing = 0] >= 2) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: { ...context.calcMods?.attacker?.accuracy, bonus: (context.calcMods?.attacker?.accuracy?.bonus || 0) - 40} } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: { ...context.calcMods?.attacker?.focus, bonus: (context.calcMods?.attacker?.focus?.bonus || 0) - 40} };
                        else if (this.vars.caster.position === "front" && context.attacker === this.vars.caster && !this.vars.debuffing++) for (const defender of context.defenders) if (resistDebuff(this.vars.caster, [defender])[this.vars.debuffing = 0] >= 2) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                )
            }
        },
        {
            name: "Summon Shadow",
            properties: ["mystic", "mana", "summon", "positional"],
            cost: { mana: 60 },
            description: "Summon shadow clone of a ally unit in the same position with 1 star stats for 6 turns, only one of the same clone can be summoned at a time",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("player", this.position)]) : this.skills.special.code.call(this, randTarget(unitFilter("enemy", this.position))) },
            code(target) {
                if (!target) {
                    logAction("No shadow clones can be summoned!", "warning");
                    resourceChange(this, this.skills.special.cost);
                    this.previousAction[1] = false;
                    return;
                }
                if (allUnits.find(obj => obj.custom?.summoner === this && obj.name === target[0].name + " (Shadow)")) {
                    logAction("A shadow clone of this unit is already summoned!", "warning");
                    resourceChange(this, this.skills.special.cost);
                    this.previousAction[1] = false;
                    return;
                }
                logAction(`${this.name} creates a shadow clone of ${target[0].name}!`, "buff");
                const clone = createUnit({ ...target[0], name: target[0].name + " (Shadow)" }, this.team);
                clone.skills = { ...target.skills };
                clone.custom = { ...clone.custom, summoner: this };
                Object.keys(clone.base).filter(stat => stat !== "position" && stat !== "elements").forEach(stat => { clone.base[stat] = Math.ceil(clone.base[stat] * 4 / 9) });
                clone.base.hp = Math.ceil(clone.base.hp/10);
                resetStat(clone, Object.keys(clone.base).filter(s => s !== "position" && s !== "elements" ));
                if (eventState.unitChange.length) handleEvent('unitChange', { type: 'summon', unit: clone });
                new Modifier("Summon Shadow", "Summon shadow clone of a ally unit in the same position with 1 star stats",
                    { caster: this, target: clone, duration: 6, properties: ["mystic", "summon"], listeners: { turnEnd: true, unitChange: true }, perm: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.target) {
                            if (context.type === "death") return !(this.vars.perm = false);
                            if (context.event === "turnEnd") this.vars.duration--;
                        }
                        if (this.vars.duration <= 0 && this.vars.perm) {
                            this.vars.perm = false;
                            allUnits.splice(allUnits.indexOf(this.vars.target), 1);
                            if (eventState.unitChange.length) handleEvent('unitChange', { type: 'unsummon', unit: this.vars.target })
                            for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === this.vars.target) removeModifier(modifiers[i]);
                            return true;
                        }
                    },
                    function() {},
                    function() {}
                )
            }
        },
        {
            name: "Friends with the Shadows",
            properties: ["mystic", "mana", "buff"],
            cost: { mana: 40 },
            description: "Shadow summons gain a star up equivalent stat increase, except for hp and resources, also gains the Fear of the Dark buff if active, lasts 4 turns",
            code() {
                logAction(`${this.name} empowers the shadows!`, "buff");
                new Modifier("Friends with the Shadows", "Shadow summons gain a star up equivalent stat increase, except for hp and resources, also gains the Fear of the Dark buff if active",
                    { caster: this, targets: [], duration: 4, properties: ["mystic", "buff"], listeners: { turnStart: true, unitChange: true, modifierStart: true, modifierEnd: true }, cancelListeners: ['unitChange', 'modifierStart', 'modifierEnd'], focus: true},
                    function() {
                        const mod = modifiers.find(m => m.name === "Fear of the Dark buff" && m.vars.caster === this.vars.caster);
                        this.changeTarget([], allUnits.filter(u => u.custom?.summoner === this.vars.caster));
                    },
                    function(context) {
                        if (context.type === 'summon' && context.unit.custom?.summoner === this.vars.caster) this.changeTarget([], [context.unit])
                        else if (context.type === 'unsummon' && context.unit.custom?.summoner === this.vars.caster) this.changeTarget([context.unit]);
                        else if (context.event === 'modifierStart' && context.modifier.name === "Fear of the Dark buff" && context.modifier.vars.target === this.vars.caster) for (const target of this.vars.targets) new Modifier("Fear of the Dark buff copy", context.modifier.description, { ...context.modifier.vars, target, listeners: undefined, cancelListeners: undefined}, context.modifier.init, context.modifier.onTurn, context.modifier.cancel, context.modifier.changeTarget);
                        else if (context.event === 'modifierEnd' && context.modifier.name === "Fear of the Dark buff" && context.modifier.vars.target === this.vars.caster && this.vars.child) for (const mod of this.vars.child.filter(m => m.name === "Fear of the Dark buff copy")) removeModifier(mod);
                        if (context.event === 'turnStart' && context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                if (this.vars.child) [... this.vars.child].forEach(m => removeModifier(m));
                                this.vars.applied = false;
                                for (const listener of this.vars.cancelListeners) {
                                    this.vars.listeners[listener] = false;
                                    eventState[listener].splice(eventState[listener].indexOf(this), 1);
                                }
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                const mod = modifiers.find(m => m.name === "Fear of the Dark buff" && m.vars.caster === this.vars.caster);
                                for (const target of this.vars.targets) {
                                    if (mod) new Modifier("Fear of the Dark buff copy", mod.description, { ...mod.vars, target, stats: { ...mod.vars.stats }, listeners: {}, cancel: false, applied: true }, mod.init, mod.onTurn, mod.cancel, mod.changeTarget);
                                    basicModifier("Friends with the Shadows buff", "Star up equivalent stat increase", { caster: this.vars.caster, target, properties: ["mystic", "mana", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, Math.ceil(target.base[k]/2)])) })
                                }
                                this.vars.applied = true;
                                for (const listener of this.vars.cancelListeners) {
                                    this.vars.listeners[listener] = true;
                                    eventState[listener].push(this);
                                }
                            }
                        }
                    },
                    function(remove = [], add = []) {
                        if (this.vars.applied || !this.vars.start) {
                            if (this.vars.child) this.vars.child.filter(m => remove.includes(m.vars.target)).forEach(m => removeModifier(m));
                            for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                            this.vars.targets.push(...add);
                            const mod = modifiers.find(m => m.name === "Fear of the Dark buff" && m.vars.caster === this.vars.caster);
                            for (const target of add) {
                                if (mod) new Modifier("Fear of the Dark buff copy", mod.description, { ...mod.vars, target, stats: { ...mod.vars.stats }, listeners: {}, cancel: false, applied: true }, mod.init, mod.onTurn, mod.cancel, mod.changeTarget);
                                basicModifier("Friends with the Shadows buff", "Star up equivalent stat increase", { caster: this.vars.caster, target, properties: ["mystic", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, Math.ceil(target.base[k]/2)])) })
                            }
                        } else {
                            for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                            this.vars.targets.push(...add);
                        }
                    }
                )
            }
        },
        {
            name: "Amulet of Darkness",
            properties: ["physical", "stamina", "mana", "positional", "heal"],
            cost: { stamina: 20 },
            description: `Regen a lot of mana (~35% max mana). If in backline, spends double the cost to moderately heal (~10% max hp)`,
            code() {
                resourceChange(this, { mana: 3.5 * this.manaRegen });
                this.position === 'back' && resourceChange(this, this.skills.special.cost) ? heal(this, [this], [1]) : logAction(`${this.name}'s amulet radiates with power!`, "buff");
            }
        },
        {
            name: "Accursed Lineage",
            properties: ["physical", "stamina", "mystic", "mana", "revive"],
            cost: { stamina: 15, mana: 25 },
            description: `Revives for the next 6 turns, second and later revives require to unsummon a shadow`,
            code() {
                logAction(`${this.name} hangs around the borders of life and death!`, "buff")
                new Modifier("Accursed Lineage", `Spend shadow summon to revive, first revive is free`,
                    { caster: this, target: this, duration: 5, properties: ["physical", "mystic", "revive"], listeners: { turnStart: true, unitChange: true }, cancelListeners: ['unitChange'], uses: 1 },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.target && context.type === "downed") {
                            if (this.vars.uses) this.vars.uses--;
                            else {
                                const mod = modifiers.find(m => m.name === "Summon Shadow" && m.vars.caster === this.vars.caster);
                                if (!mod) return; 
                                mod.vars.duration = 0;
                                currentAction.push([mod, mod.vars.caster]);
                                mod.onTurn({});
                                currentAction.pop();
                                removeModifier(mod);
                            }
                            heal(this.vars.caster, [this.vars.target], [3]);
                        }
                        if (context.event === "turnStart" && context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Shadow Shift",
            properties: ["physical", "stamina", "mystic", "mana", "positional"],
            cost: { stamina: 10, mana: 10 },
            description: "Switch between front and backline positions and immediately gain 2 turns",
            code() {
                this.switchPosition();
                this.timer -= 2000;
            }
        }
    ],
    basic: [
        {
            name: "Shadow Blade",
            properties: ["physical", "mystic", "attack"],
            cost: { position: "front" },
            description: "Makes 2 attacks at a single target with increased accuracy and attack",
            code() { attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 2, { attacker: { attack: { bonus: 36 }, accuracy: { bonus: 50 } } }) }
        },
        {
            name: "Ball of Darkness",
            properties: ["physical", "mystic", "attack", "multi-target"],
            cost: { position: "back" },
            description: "Makes an attack at a random target with increased accuracy. On hit, randomly targets another enemy with the attack and continues until miss or all units are hit",
            code() { for (const target of unitFilter(this.team === "player" ? "enemy" : "player", "front", false).map(val => ({ val, rand: Math.random() })).sort((a, b) => a.rand - b.rand).map(({ val }) => val)) if (!(attack(this, [target], 1, { attacker: { accuracy: { mult: 2 } } }) > 0)) break; }
        },
        {
            name: "Summon Shadow",
            properties: ["mystic", "mana", "summon", "positional"],
            cost: { mana: 20 },
            description: "Summons a 1 star shadow for 4 turns, can't have more shadows than non-summon allies in the same position",
            code() {
                if (unitFilter(this.team, this.position).filter(obj => !obj.custom?.summoner).length <= allUnits.filter(obj => obj.custom?.summoner === this && obj.position === this.position).length) {
                    logAction("Cannot summon more shadows than allies in the same position!", "warning");
                    resourceChange(this, this.skills.basic.cost);
                    this.previousAction[1] = false;
                    return;
                }
                logAction(`${this.name} creates a shadow.`, "action");
                const clone = createUnit(new Unit("Shadow", [290, 13, 11, 49, 66, 60, 60, 30, 24, this.position, 16, 10, 1, 40, 8]), this.team);
                clone.skills = shadowSkills;
                clone.custom = { ...clone.custom, summoner: this };
                if (eventState.unitChange.length) handleEvent('unitChange', { type: 'summon', unit: clone });
                new Modifier("Summon Shadow", "Summon 1 star shadow",
                    { caster: this, target: clone, duration: 4, properties: ["mystic", "summon"], listeners: { turnEnd: true, unitChange: true }, perm: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.target) {
                            if (context.type === "death") return !(this.vars.perm = false);
                            if (context.event === "turnEnd") this.vars.duration--;
                        }
                        if (this.vars.duration <= 0 && this.vars.perm) {
                            this.vars.perm = false;
                            allUnits.splice(allUnits.indexOf(this.vars.target), 1);
                            if (eventState.unitChange.length) handleEvent('unitChange', { type: 'unsummon', unit: this.vars.target})
                            for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === this.vars.target) removeModifier(modifiers[i]);
                            return true;
                        }
                    },
                    function() {},
                    function() {}
                )
            }
        },
        {
            name: "Amulet of Darkness",
            properties: ["physical", "stamina", "mana", "positional", "heal"],
            cost: { stamina: 10 },
            description: `Regen a lot of mana (~25% max mana). If in backline, spends double the cost to heal slightly (~5% max hp)`,
            code() {
                resourceChange(this, { mana: 2.5 * this.manaRegen });
                this.position === 'back' && resourceChange(this, this.skills.basic.cost) ? heal(this, [this], [0.5]) : logAction(`${this.name}'s amulet is covered in shadow`, "buff");
            }
        },
        {
            name: "Shadow Shift",
            properties: ["physical", "mystic", "positional"],
            description: "Switch between front and backline positions and immediately gain next turn",
            code() {
                this.switchPosition();
                this.timer -= 1000;
            }
        }
    ],
    secondary: [
        {
            name: "Shadow Blade",
            properties: ["attack"],
            cost: { position: "front" },
            description: "Attacks a single target with increased accuracy and attack",
            code() { attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 1, { attacker: { attack: { bonus: 36 }, accuracy: { bonus: 50 } } }) }
        },
        {
            name: "Ball of Darkness",
            properties: ["attack", "multi-target"],
            cost: { position: "back" },
            description: "Attacks a single target with double accuracy, attacks again on hit",
            code() { if (attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 1, { attacker: { accuracy: { mult: 2 } } })) attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 1, { attacker: { accuracy: { mult: 2 } } }) }
        },
        {
            name: "Fear of the Dark",
            properties: ["buff", "debuff", "positional"],
            description: "Increases evasion/focus/presence, chance to gives advantage to attacks at frontline, chance to decreases enemy accuracy or focus of attacks/debuff to self at the backline, until end of next turn",
            code() {
                const mod = modifiers.find(m => m.name === "Fear of the Dark buff" && m.vars.caster === this);
                mod ? (mod.duration++ && logAction(`${this.name} refreshes ${mod.name}`)) : basicModifier("Fear of the Dark buff", "Increases evasion/focus/presence", { caster: this, target: this, duration: 2, properties: ["physical", "mystic", "buff"], stats: { evasion: 20, focus: 10, presence: 20 }, listeners: { turnEnd: true }, focus: true });
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, 1% chance to fail",
                    { caster: this, target: this, duration: 2, properties: ["physical", "mystic", "buff", "debuff", "positional"], listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], focus: true, debuffing: 0 },
                    function() {},
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders?.includes(this.vars.caster) && !this.vars.debuffing++ && resistDebuff(this.vars.caster, [context.attacker])[this.vars.debuffing = 0] > 24) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: { ...context.calcMods?.attacker?.accuracy, bonus: (context.calcMods?.attacker?.accuracy?.bonus || 0) - 40} } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: { ...context.calcMods?.attacker?.focus, bonus: (context.calcMods?.attacker?.focus?.bonus || 0) - 40} };
                        else if (this.vars.caster.position === "front" && context.attacker === this.vars.caster && !this.vars.debuffing++) for (const defender of context.defenders) if (resistDebuff(this.vars.caster, [defender])[this.vars.debuffing = 0] > 24) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                )
            }
        },
        {
            name: "Amulet of Darkness",
            properties: ["mana", "positional", "heal"],
            description: `Regen a lot of mana (~15% max mana). If in backline, disable stamina regen to heal slightly (~5% max hp)`,
            code() {
                resourceChange(this, { mana: 1.5 * this.manaRegen });
                this.position === 'back' ? (this.previousAction[0] = true && heal(this, [this], [.5])) : logAction(`${this.name}'s amulet flickers`, "buff");
            }
        },
        {
            name: "Shadow Shift",
            properties: ["positional"],
            description: "Switch between front and backline positions",
            code() { this.switchPosition() }
        }
    ],
    passive: [
        {
            name: "Fear of the Dark",
            properties: ["physical", "stamina", "mystic", "mana", "buff", "debuff", "positional"],
            reduction: { staminaRegen: 1, manaRegen: 2 },
            description: "Increases evasion/focus/presence, chance to gives advantage to attacks at frontline, chance to decreases enemy accuracy or focus of attacks/debuff to self at the backline",
            code() {
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline",
                    { caster: this, target: this, properties: ["physical", "mystic", "buff", "debuff", "positional"], stats: { evasion: 20, focus: 10, presence: 20 }, listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], reduction: this.skills.passive.reduction, focus: true, passive: true, debuffing: 0 },
                    function() {},
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders.includes(this.vars.caster) && !this.vars.debuffing++ && resistDebuff(this.vars.caster, [context.attacker])[this.vars.debuffing = 0] > 33) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: { ...context.calcMods?.attacker?.accuracy, bonus: (context.calcMods?.attacker?.accuracy?.bonus || 0) - 40} } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: { ...context.calcMods?.attacker?.focus, bonus: (context.calcMods?.attacker?.focus?.bonus || 0) - 40} };
                        else if (this.vars.caster.position === "front" && context.attacker === this.vars.caster && !this.vars.debuffing++) for (const defender of context.defenders) if (resistDebuff(this.vars.caster, [defender])[this.vars.debuffing = 0] > 33) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                    }
                )
            }
        },
        {
            name: "Friends with the Shadows",
            properties: ["mystic", "mana", "buff"],
            reduction: { mana: 40 },
            description: "Shadow summons get star up equivelant stats",
            code() {
                new Modifier("Friends with the Shadows", "Shadow summons get star up equivelant stats",
                    { caster: this, targets: [], properties: ["mystic", "buff"], listeners: { unitChange: true }, cancelListeners: ['unitChange'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function() {
                        this.vars.caster.mana = Math.max(this.vars.caster.base.mana -= 40, 0);
                        this.changeTarget([], allUnits.filter(u => u.custom?.summoner === this.vars.caster));
                    },
                    function(context) {
                        if (context.unit.custom?.summoner !== this.vars.caster) return;
                        if (context.type === 'summon') this.changeTarget([], [context.unit]);
                        else if (context.type === 'unsummon') this.changeTarget([context.unit], []);
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                modifiers.filter(m => this.vars.targets.includes(m.vars.target) && m.vars.caster === this.vars.caster).forEach(m => m.cancel());
                                this.vars.applied = false;
                                this.vars.listeners.unitChange = false;
                                eventState.unitChange.splice(eventState.unitChange.indexOf(this), 1);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                for (const target of this.vars.targets) modifiers.filter(m => m.name === "Friends with the Shadows buff" && m.vars.caster === this.vars.caster && m.vars.target === target).forEach(m => m.cancel(false));
                                this.vars.applied = true;
                                this.vars.listeners.unitChange = true;
                                eventState.unitChange.push(this);
                            }
                        }
                    },
                    function(remove = [], add = []) {
                        if (this.vars.applied || !this.vars.start) {
                            if (this.vars.child) this.vars.child.filter(m => remove.includes(m.vars.target)).forEach(m => removeModifier(m));
                            for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                            this.vars.targets.push(...add);
                            for (const target of add) basicModifier("Friends with the Shadows buff", "Star up equivalent stat increase", { caster: this.vars.caster, target, properties: ["mystic", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, Math.ceil(target.base[k]/2)])) })
                        } else {
                            for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                            this.vars.targets.push(...add);
                        }
                    }
                )
            }
        },
        {
            name: "Amulet of Darkness",
            properties: ["physical", "stamina", "mana", "positional", "heal"],
            reduction: { stamina: 20, staminaRegen: 2 },
            description: "Regen mana (~10% max mana) each turn. If at backline, double reduction to also heal (~5% hp) each turn",
            code() {
                new Modifier("Amulet of Darkness", `Regen mana (~10% max mana)${this.position === 'back' ? ' and heal (~5% hp)' : ''} each turn`,
                    { caster: this, target: this, properties: this.position === "back" ? ["physical", "mana", "heal"] : ["physical", "mana"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.position === 'back' ? Object.fromEntries(Object.entries(this.skills.passive.reduction).map(([k, v]) => [k, 2*v])) : this.skills.passive.reduction, passive: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster && this.vars.applied ){
                            resourceChange(this.vars.target, { mana: this.vars.target.manaRegen });
                            if (this.vars.caster.position === 'back') heal(this.vars.caster, [this.vars.target], [0.5]);
                        }
                    }
                )
            }
        },
        {
            name: "Accursed Lineage",
            properties: ["physical", "stamina", "mystic", "mana", "revive"],
            reduction: { stamina: 10, mana: 20 },
            description: `Revives at the cost of unsummmoning a shadow, fails if no shadow to unsummon`,
            code() {
                new Modifier("Accursed Lineage", `Spend shadow summon to revive`,
                    { caster: this, target: this, properties: ["physical", "mystic", "revive"], listeners: { unitChange: true }, cancelListeners: ['unitChange'], reduction: this.skills.passive.reduction, passive: true },
                    function() {},
                    function(context) {
                        if (context.unit !== this.vars.caster) return;
                        if (this.vars.applied && context.type === "downed") {
                            const mod = modifiers.find(m => m.name === "Summon Shadow" && m.vars.caster === this.vars.caster);
                            if (!mod) return;
                            mod.vars.duration = 0;
                            currentAction.push([mod, mod.vars.caster]);
                            mod.onTurn({});
                            currentAction.pop();
                            removeModifier(mod);
                            heal(this.vars.caster, [this.vars.target], [3]);
                        }
                    }
                );
            }
        }
    ],
    augment: [
        {
            name: "Fear of the Dark",
            properties: ["physical", "stamina", "mystic", "mana", "buff", "debuff", "positional"],
            reduction: { staminaRegen: 1, manaRegen: 2 },
            description: "Increases evasion/focus/presence, chance to gives advantage to attacks at frontline, chance to decreases enemy accuracy or focus of attacks/debuff to self at the backline",
            code() {
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline",
                    { caster: this, target: this, properties: ["physical", "mystic", "buff", "debuff", "positional"], stats: { evasion: 30, focus: 15, presence: 30 }, listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], reduction: this.skills.augment.reduction, focus: true, passive: true, debuffing: 0 },
                    function() {},
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders.includes(this.vars.caster) && !this.vars.debuffing++ && resistDebuff(this.vars.caster, [context.attacker])[this.vars.debuffing = 0] > 33) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: { ...context.calcMods?.attacker?.accuracy, bonus: (context.calcMods?.attacker?.accuracy?.bonus || 0) - 40} } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: { ...context.calcMods?.attacker?.focus, bonus: (context.calcMods?.attacker?.focus?.bonus || 0) - 40} };
                        else if (this.vars.caster.position === "front" && context.attacker === this.vars.caster && !this.vars.debuffing++) for (const defender of context.defenders) if (resistDebuff(this.vars.caster, [defender])[this.vars.debuffing = 0] > 33) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                    }
                )
            }
        },
        {
            name: "Friends with the Shadows",
            properties: ["mystic", "mana", "buff"],
            reduction: { mana: 40 },
            description: "Shadow summons get star and a half up equivelant stats",
            code() {
                new Modifier("Friends with the Shadows", "Shadow summons get star up equivelant stats",
                    { caster: this, targets: [], properties: ["mystic", "buff"], listeners: { unitChange: true }, cancelListeners: ['unitChange'], reduction: this.skills.augment.reduction, focus: true, passive: true },
                    function() {
                        this.vars.caster.mana = Math.max(this.vars.caster.base.mana -= 40, 0);
                        this.changeTarget([], allUnits.filter(u => u.custom?.summoner === this.vars.caster));
                    },
                    function(context) {
                        if (context.unit.custom?.summoner !== this.vars.caster) return;
                        if (context.type === 'summon') this.changeTarget([], [context.unit]);
                        else if (context.type === 'unsummon') this.changeTarget([context.unit], []);
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                modifiers.filter(m => this.vars.targets.includes(m.vars.target) && m.vars.caster === this.vars.caster).forEach(m => m.cancel());
                                this.vars.applied = false;
                                this.vars.listeners.unitChange = false;
                                eventState.unitChange.splice(eventState.unitChange.indexOf(this), 1);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                for (const target of this.vars.targets) modifiers.filter(m => m.name === "Friends with the Shadows buff" && m.vars.caster === this.vars.caster && m.vars.target === target).forEach(m => m.cancel(false));
                                this.vars.applied = true;
                                this.vars.listeners.unitChange = true;
                                eventState.unitChange.push(this);
                            }
                        }
                    },
                    function(remove = [], add = []) {
                        if (this.vars.applied || !this.vars.start) {
                            if (this.vars.child) this.vars.child.filter(m => remove.includes(m.vars.target)).forEach(m => removeModifier(m));
                            for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                            this.vars.targets.push(...add);
                            for (const target of add) basicModifier("Friends with the Shadows buff", "Star up equivalent stat increase", { caster: this.vars.caster, target, properties: ["mystic", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, Math.ceil(target.base[k] * (Math.pow(1.5, 1.5) - 1))])) })
                        } else {
                            for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                            this.vars.targets.push(...add);
                        }
                    }
                )
            }
        },
        {
            name: "Amulet of Darkness",
            properties: ["physical", "stamina", "mana", "positional", "heal"],
            reduction: { stamina: 20, staminaRegen: 2 },
            description: "Regen mana (~15% max mana) each turn. If at backline, double reduction to also heal (~7.5% hp) each turn",
            code() {
                new Modifier("Amulet of Darkness", `Regen mana (~15% max mana)${this.position === 'back' ? ' and heal (~5% hp)' : ''} each turn`,
                    { caster: this, target: this, properties: this.position === "back" ? ["physical", "mana", "heal"] : ["physical", "mana"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.position === 'back' ? Object.fromEntries(Object.entries(this.skills.passive.reduction).map(([k, v]) => [k, 2*v])) : this.skills.passive.reduction, passive: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster && this.vars.applied ){
                            resourceChange(this.vars.target, { mana: this.vars.target.manaRegen * 1.5 });
                            if (this.vars.caster.position === 'back') heal(this.vars.caster, [this.vars.target], [0.75]);
                        }
                    }
                )
            }
        },
    ]
}

Silhouette.frontDefaultSkills = [
    { category: 'special', name: 'Friends with the Shadows' },
    { category: 'basic', name: 'Summon Shadow' },
    { category: 'secondary', name: 'Shadow Shift' },
    { category: 'passive', name: 'Accursed Lineage' },
    { category: 'augment', name: 'Fear of the Dark' }
];

Silhouette.backDefaultSkills = [
    { category: 'special', name: 'Friends with the Shadows' },
    { category: 'basic', name: 'Summon Shadow' },
    { category: 'secondary', name: 'Shadow Shift' },
    { category: 'passive', name: 'Accursed Lineage' },
    { category: 'augment', name: 'Fear of the Dark' }
];

Silhouette.switchPosition = function(silent = false) {
    if (this.position === "back") {
        this.position = "front";
        this.base.accuracy = 140;
        this.base.evasion = 95;
        this.base.focus = 170;
        this.base.resist = 100;
        this.base.speed = 85;
        this.skills = {...this.frontSkills}
    } else {
        this.position = "back";
        this.base.accuracy = 110;
        this.base.evasion = 160;
        this.base.focus = 135;
        this.base.resist = 140;
        this.base.speed = 75;
        this.skills = {...this.backSkills}
    }
    logAction(`${this.name} shifts to the ${this.position}line.`, "info");
    resetStat(this, ["accuracy", "evasion", "focus", "resist", "speed"]);
    if (!silent && eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position });
}

const shadowSkills = {
    special: {
        name: "Proliferate",
        properties: ["summon"],
        description: "If a target with a Strength Drain debuff is downed, create a new shadow",
        code() {
            if (modifiers.filter(m => m.name === "Strength Drain debuff").map(m => m.vars.target).some(t => t.hp <= 0)) {
                logAction(`${this.name} proliferates!`, "action")
                const clone = createUnit(this, this.team);
                clone.skills = this.skills;
                clone.custom = { ...clone.custom, summoner: this};
                if (eventState.unitChange.length) handleEvent('unitChange', { type: 'summon', unit: clone});
            } else logAction(`${this.name} fails to proliferate!`, "miss");
        }
    },
    basic: {
        name: "Strike",
        properties: ["attack"],
        description: "Attacks a single target",
        code() { attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false))) }
    },
    passive: {
        name: "Strength Drain",
        properties: ["mystic", "debuff"],
        description: "On hit, reduce target attack until caster is out of combat, 1% chance to fail",
        code() {
            new Modifier("Strength Drain", "On hit, reduce target attack until caster is out of combat, 1% chance to fail",
                { caster: this, target: this, properties: ['mystic', 'debuff'], listeners: { singleDamage: true }, cancelListeners: ['singleDamage'], passive: true },
                function() {},
                function(context) {
                    if (context.attacker === this.vars.caster && context.damageSingle > 0) {
                        const will = resistDebuff(this.vars.caster, [context.defender]);
                        if (will >= 2) basicModifier("Strength Drain debuff", "Reduce target attack until caster is out of combat", { caster: this.vars.caster, target: context.defender, properties: ['mystic', 'debuff'], stats: { attack: -(will === 100 ? 6 : Math.ceil(will/25)) } });
                    }
                }
            )
        }
    }
}