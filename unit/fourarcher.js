import { setUnit, sleep, unitFilter, Modifier, handleEvent, removeModifier, basicModifier, logAction, resetStat, regenerateResources, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, modifiers, currentUnit, currentAction, elements, eventState } from '../combatDictionary.js';
import { Unit, allUnits } from './unit.js';

export const FourArcher = new Unit("4 (Archer)", [800, 24, 16, 50, 80, 70, 140, 85, 160, "back", 110, 40, 4, 160, 32]);

FourArcher.description = "3-star mystic backline unit with high crit/debuff resist but low in everything else, capable of manipulating RNG to buff self and debuff enemies."

FourArcher.skills = {
    special: [
        {
            name: "Perfect Shot",
            properties: ["mystic", "mana", "attack", "auto-hit", "auto-crit"],
            cost: { mana: -40 },
            description: "Cost 40 mana\nDeals a critical hit to a single target, 99% chance to ignore half of defense",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front", false))) },
            code(target) { damage(this, target, [[4]], { defenders: { defense: { div: resistDebuff(this, target)[0] < 2 ? 1 : 2 } } }) }
        },
        {
            name: "Unnatural Luck",
            properties: ["mystic", "mana", "buff", "debuff"],
            cost: { mana: -20 },
            description: "Cost 20 mana\nRolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has disadvantage until end of next turn, 1% chance to fail to give disadvantage.",
            code() {
                new Modifier("Unnatural Luck", "Rolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has disadvantage, 1% chance to fail to give disadvantage.",
                    { caster: this, target: this, duration: 2, properties: ["mystic", "buff", "debuff"], listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], debuffing: 0 },
                    function() {},
                    function(context) {
                        if (context.event !== "turnEnd") {
                            if (context.attacker === this.vars.caster) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                            if (context.defenders.includes(this.vars.caster) && !this.vars.debuffing++ && resistDebuff(this.vars.caster, [context.attacker])[this.vars.debuffing = 0] >= 2) for (let i = 0; i < context.defenders.length; i++) if (context.defenders[i] === this.vars.caster) ((context.calcMods.defenders ??= [])[i] ??= { reroll: 0 }).reroll--;
                        } else if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                )
            }
        },
        {
            name: "Lazing Around",
            properties: ["physical", "stamina", "mana", "penalty", "resource"],
            cost: { stamina: -10 },
            description: "Cost 10 stamina\nReduces speed until next turn then regain mana (~35% max mana)",
            code() {
                new Modifier("Lazing Around", "Reduces speed and regen mana.",
                    { caster: this, target: this, duration: 1, properties: ["physical", "mana", "penalty", "resource"], stats: { speed: -10 }, listeners: { turnStart: true }, penalty: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) resourceChange(this.vars.caster, { mana: this.vars.caster.manaRegen * 3.5 });
                            this.vars.duration--;
                        }
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Rebound Arc",
            properties: ["mystic", "mana", "buff"],
            cost: { mana: -40 },
            description: "Cost 40 mana\nMissed attacks have a chance to hit a random enemy and non-crit guaranteed hits can make an attack to pierce a random enemy for 4 turns",
            code() {
                new Modifier("Rebound Arc", "Missed attack have a chance to hit a random enemy and non-crit guaranteed hits can make an attack to pierce a random enemy",
                    { caster: this, target: this, duration: 5, properties: ["mystic", "buff"], listeners: { turnEnd: true, singleAttack: true, singleDamage: true }, cancelListeners: ['singleAttack', 'singleDamage'], attacking: false },
                    function() {},
                    function(context) {
                        if (this.vars.attacking) return;
                        if (context.event === "singleAttack" && context.attacker === this.vars.caster && context.hitSingle <= 0) {
                            this.vars.attacking = true;
                            let target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                            if (resistDebuff(this.vars.caster, target)[0] > 70) crit(this.vars.caster, target, [[this.accuracy/2]]);
                        } else if (context.event === "singleDamage" && context.attacker === this.vars.caster && (currentAction.at(-2).properties?.includes("auto-hit") || currentAction.at(-2).vars?.properties?.includes("auto-hit")) && context.critical < 1) {
                            this.vars.attacking = true;
                            attack(this.vars.caster, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 1, context.calcMods);
                        }
                        this.vars.attacking = false;
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                )
            }
        },
        {
            name: "Lucky Aura",
            properties: ["mystic", "mana", "buff"],
            description: "Cost 40 mana\nIncreases all alive allies accuracy/evasion/focus/resist/presence for one of their turns",
            code() { for (const unit of unitFilter(this.team, '', false).filter(u => u !== this)) basicModifier("Lucky Aura", "Increases accuracy/evasion/focus/resist/presence", { caster: this, target: unit, duration: 2, properties: ["mystic", "buff"], stats: { accuracy: 25, evasion: 45, focus: 35, resist: 40, presence: 40 }, listeners: { turnStart: true } }) }
        },
        {
            name: "Luck Arrow",
            properties: ["mystic", "mana", "attack", "auto-hit", "buff", "debuff"],
            description: "Cost 20 mana\nMakes a guaranteed hit to a single target, gives self advantage to next few attacks/debuffs depending on chance and chance to give disadvantage to target's next few attacks/debuffs, 1% chance to fail to give advantage",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front", false))) },
            code(target) {
                attack(this, target, 1, { max: [[.5]] });
                let will = resistDebuff(this, target);
                new Modifier("Luck Arrow buff", "Gives advantage to next few attacks/debuffs",
                    { caster: this, target: this, duration: will[0] < 2 ? 0 : will[0] > 99 ? 7 : Math.ceil(will[0]/33), properties: ["mystic", "buff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'] },
                    function() { return !this.vars.duration },
                    function(context) {
                        if (context.attacker === this.vars.caster) this.vars.duration--, (context.calcMods.all ??= { reroll: 0 }).reroll++;
                        return this.vars.duration <= 0;
                    }
                );
                will = resistDebuff(this, target);
                new Modifier("Luck Arrow debuff", "Gives disadvantage to target's next few attacks/debuffs",
                    { caster: this, target: target[0], duration: will[0] > 99 ? 7 : Math.floor(will[0]/25), properties: ["mystic", "debuff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'] },
                    function() { return !this.vars.duration },
                    function(context) {
                        if (context.attacker === this.vars.target) this.vars.duration--, context.calcMods.all ? context.calcMods.all.reroll = (context.calcMods.all.reroll || 0) - 1 : context.calcMods.all = { reroll: -1 };
                        return this.vars.duration <= 0;
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
            code() {
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                attack(this, target, 1, { max: [[.5]], defenders: { defense: { bonus: resistDebuff(this, target)[0] < 2 ? 0 : -10 } } });
            }
        },
        {
            name: "Lazing Around",
            properties: ["physical", "mana", "penalty", "resource"],
            description: "Reduces speed until next turn then regain mana (~30% max mana)",
            code() {
                new Modifier("Lazing Around", "Reduces speed and regen mana.",
                    { caster: this, target: this, duration: 1, properties: ["physical", "mana", "penalty", "resource"], stats: { speed: -10 }, listeners: { turnStart: true }, penalty: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) resourceChange(this.vars.caster, { mana: this.vars.caster.manaRegen * 3 });
                            this.vars.duration--;
                        }
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Lucky Aura",
            properties: ["physical", "buff"],
            description: "Increases 4 random ally accuracy/evasion/focus/resist/presence for one of their turns",
            code() { for (const target in randTarget(unitFilter(this.team, '', false), 4, true)) basicModifier("Lucky Aura", "Increases accuracy/evasion/focus/resist/presence", { caster: this, target, duration: 2, properties: ["mystic", "mana", "buff"], stats: { accuracy: 25, evasion: 45, focus: 35, resist: 40, presence: 40 }, listeners: { turnStart: true } }) }
        },
        {
            name: "Luck Arrow",
            properties: ["mystic", "mana", "attack", "auto-hit", "buff", "debuff"],
            description: "Attacks a single target, on hit, chance to give self advantage to next few attacks/debuffs and chance to give disadvantage to target's next few attacks/debuffs",
            code() {
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                if (attack(this, target, 1)[0] > 0) {
                    let will = resistDebuff(this, target);
                    new Modifier("Luck Arrow buff", "Gives advantage to next few attacks/debuffs",
                        { caster: this, target: this, duration: will[0] > 99 ? 7 : Math.ceil(will[0]/25), properties: ["mystic", "buff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'] },
                        function() { return !this.vars.duration },
                        function(context) {
                            if (context.attacker === this.vars.caster) this.vars.duration--, (context.calcMods.all ??= { reroll: 0 }).reroll++;
                            return this.vars.duration <= 0;
                        }
                    );
                    will = resistDebuff(this, target);
                    new Modifier("Luck Arrow debuff", "Gives disadvantage to target's next few attacks/debuffs",
                        { caster: this, target: target[0], duration: will[0] > 99 ? 4 : Math.floor(will[0]/33), properties: ["mystic", "debuff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'] },
                        function() { return !this.vars.duration },
                        function(context) {
                            if (context.attacker === this.vars.target) this.vars.duration--, context.calcMods.all ? context.calcMods.all.reroll = (context.calcMods.all.reroll || 0) - 1 : context.calcMods.all = { reroll: -1 };
                            return this.vars.duration <= 0;
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
            code() { damage(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), [[.5]]) }
        },
        {
            name: "Lazing Around",
            properties: ["mana", "penalty", "resource"],
            description: "Reduces speed until next turn then regain mana (~25% max mana)",
            code() {
                new Modifier("Lazing Around", "Reduces speed and regen mana.",
                    { caster: this, target: this, duration: 1, properties: ["physical", "mana", "penalty", "resource"], stats: { speed: -10 }, listeners: { turnStart: true }, penalty: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) resourceChange(this.vars.caster, { mana: this.vars.caster.manaRegen * 2.5 });
                            this.vars.duration--;
                        }
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Lucky Aura",
            properties: ["buff"],
            description: "Increases a random alive ally accuracy/evasion/focus/resist/presence for one of their turns",
            code() { basicModifier("Lucky Aura", "Increases accuracy/evasion/focus/resist/presence", { caster: this, target: randTarget(unitFilter(this.team, '', false), 1, true)[0], duration: 2, properties: ["mystic", "mana", "buff"], stats: { accuracy: 25, evasion: 45, focus: 35, resist: 40, presence: 40 }, listeners: { turnStart: true } }) }
        }
    ],
    passive: [
        {
            name: "Unnatural Luck",
            properties: ["mystic", "mana", "buff", "debuff"],
            description: "Reduce max mana by 40 and base mana regen by 8\nRolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has chance to debuff to disadvantage until end of next turn.",
            code() {
                this.mana = (this.base.mana -= 40);
                this.base.manaRegen -= 8;
                resetStat(this, ['manaRegen']);
                new Modifier("Unnatural Luck", "Rolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has chance to debuff to disadvantage.",
                    { caster: this, target: this, properties: ["mystic", "mana", "buff", "debuff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], passive: true, debuffing: 0 },
                    function() {},
                    function(context) {
                        if (context.attacker === this.vars.caster) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                        if (context.defenders.includes(this.vars.caster) && !this.vars.debuffing++ && resistDebuff(this.vars.caster, [context.attacker])[this.vars.debuffing = 0] > 50) for (let i = 0; i < context.defenders.length; i++) if (context.defenders[i] === this.vars.caster) ((context.calcMods.defenders ??= [])[i] ??= { reroll: 0 }).reroll--;
                    }
                )
            }
        },
        {
            name: "Lazing Around",
            properties: ["mana", "penalty", "resource"],
            description: "Reduce speed and regen mana (~10% max mana) each turn",
            code() {
                new Modifier("Lazing Around", "Reduces speed and regen mana.",
                    { caster: this, target: this, properties: ["physical", "mana", "penalty", "resource"], stats: { speed: -20 }, penalty: true, passive: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) { if (context.unit === this.vars.caster && this.vars.applied) resourceChange(this.vars.caster, { mana: this.vars.caster.manaRegen }) }
                );
            }
        },
        {
            name: "Rebound Arc",
            properties: ["mystic", "mana", "buff"],
            cost: { mana: -10 },
            description: "Missed attack have a chance to hit a random enemy and non-crit guaranteed hits can make an attack to pierce a random enemy, spend 10 mana after use",
            code() {
                new Modifier("Rebound Arc", "Missed attack have a chance to hit a random enemy and non-crit guaranteed hits can make an attack to pierce a random enemy",
                    { caster: this, target: this, properties: ["mystic", "mana", "buff"], listeners: { singleAttack: true, singleDamage: true }, cancelListeners: ['singleAttack', 'singleDamage'], cost: { mana: -10 }, passive: true, attacking: false },
                    function() {},
                    function(context) {
                        if (this.vars.attacking) return;
                        if (context.event === "singleAttack" && context.attacker === this.vars.caster && context.hitSingle <= 0 && resourceChange(this.vars.caster, { mana: -10 })) {
                            this.vars.attacking = true;
                            let target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                            if (resistDebuff(this.vars.caster, target)[0] > 70) crit(this.vars.caster, target, [[this.accuracy/4]]);
                        } else if (context.event === "singleDamage" && context.attacker === this.vars.caster && (currentAction.at(-2).properties?.includes("auto-hit") || currentAction.at(-2).vars?.properties?.includes("auto-hit")) && context.critical < 1 && resourceChange(this.vars.caster, { mana: -10 })) {
                            this.vars.attacking = true;
                            attack(this.vars.caster, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 1, context.calcMods)
                        }
                        this.vars.attacking = false;
                    }
                )
            }
        },
        {
            name: "Lucky Aura",
            properties: ["mystic", "buff"],
            description: "Increases a random alive ally accuracy/evasion/focus/resist/presence for one of their turns",
            code() {
                new Modifier("Lucky Aura", "Increases accuracy/evasion/focus/resist/presence",
                    { caster: this, target: this, duration: 2, properties: ["mystic", "buff"], stats: { accuracy: 5, evasion: 20, focus: 10, resist: 20, presence: 20 }, listeners: { turnStart: true }, passive: true },
                    function() { this.changeTarget(randTarget(unitFilter(this.team, '', false).filter(u => u !== this.vars.caster), 1, true)[0]) },
                    function (context) { if (context.unit === this.vars.caster) this.changeTarget(randTarget(unitFilter(this.team, '', false).filter(u => u !== this.vars.caster), 1, true)[0]) }
                );
            }
        },
        {
            name: "Luck Arrow",
            properties: ["mystic", "mana", "buff", "debuff"],
            description: "Reduce max mana by 40 and base mana regen by 8\nOn hit with any attack, chance to give self advantage to next few attacks/debuffs and chance to give disadvantage to target's next few attacks/debuffs",
            code() {
                this.mana = (this.base.mana -= 40);
                this.base.manaRegen -= 8;
                resetStat(this, ['manaRegen']);
                new Modifier("Luck Arrow", "On hit with any attack, chance to give self advantage to next few attacks/debuffs and chance to give disadvantage to target's next few attacks/debuffs",
                    { caster: this, target: this, properties: ["mystic", "mana", "buff", "debuff"], listeners: { singleDamage: true }, cancelListeners: ['singleDamage'], passive: true },
                    function() {},
                    function(context) {
                        if (context.event === "singleDamage") {
                            let mod = modifiers.find(m => m.name === "Luck Arrow buff" && m.vars.caster === this.vars.caster), will = resistDebuff(this.vars.caster, [context.defender]);
                            mod ? (mod.vars.duration += will[0] > 99 ? 7 : Math.ceil(will[0])/25) :
                            new Modifier("Luck Arrow buff", "Gives advantage to next few attacks/debuffs",
                                { caster: this.vars.caster, target: this.vars.caster, duration: will[0] > 99 ? 7 : Math.ceil(will[0]/25), properties: ["mystic", "buff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'] },
                                function() { return !this.vars.duration },
                                function(context) {
                                    if (this.vars.applied && context.attacker === this.vars.caster) this.vars.duration--, (context.calcMods.all ??= { reroll: 0 }).reroll++;
                                    return this.vars.duration <= 0;
                                }
                            );
                            mod = modifiers.find(m => m.name === "Luck Arrow debuff" && m.vars.target === context.defender);
                            will = resistDebuff(this.vars.caster, [context.defender]);
                            mod ? (mod.vars.duration += will[0] > 99 ? 4 : Math.floor(will[0]/33)) :
                            new Modifier("Luck Arrow debuff", "Gives disadvantage to target's next few attacks/debuffs",
                                { caster: this.vars.caster, target: context.defender, duration: will[0] > 99 ? 4 : Math.floor(will[0]/33), properties: ["mystic", "debuff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'] },
                                function() { return !this.vars.duration },
                                function(context) {
                                    if (this.vars.applied && context.attacker === this.vars.target) this.vars.duration--, context.calcMods.all ? context.calcMods.all.reroll = (context.calcMods.all.reroll || 0) - 1 : context.calcMods.all = { reroll: -1 };
                                    return this.vars.duration <= 0;
                                }
                            )
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
            description: "Reduce max mana by 40 and base mana regen by 8\nRolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has chance to debuff to disadvantage until end of next turn.",
            code() {
                this.mana = (this.base.mana -= 40);
                this.base.manaRegen -= 8;
                resetStat(this, ['manaRegen']);
                new Modifier("Unnatural Luck", "Rolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has chance to debuff to disadvantage.",
                    { caster: this, target: this, properties: ["mystic", "mana", "buff", "debuff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], passive: true, debuffing: 0 },
                    function() {},
                    function(context) {
                        if (context.attacker === this.vars.caster) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                        if (context.defenders.includes(this.vars.caster) && !this.vars.debuffing++ && resistDebuff(this.vars.caster, [context.attacker])[--this.vars.debuffing] > 25) for (let i = 0; i < context.defenders.length; i++) if (context.defenders[i] === this.vars.caster) ((context.calcMods.defenders ??= [])[i] ??= { reroll: 0 }).reroll--;
                    }
                )
            }
        },
        {
            name: "Lazing Around",
            properties: ["mana", "penalty", "resource"],
            description: "Reduce speed and regen mana (~15% max mana) each turn",
            code() {
                new Modifier("Lazing Around", "Reduces speed and regen mana.",
                    { caster: this, target: this, properties: ["physical", "mana", "penalty", "resource"], stats: { speed: -10 }, penalty: true, passive: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) { if (context.unit === this.vars.caster && this.vars.applied) resourceChange(this.vars.caster, { mana: this.vars.caster.manaRegen * 1.5 }) }
                );
            }
        },
        {
            name: "Lucky Aura",
            properties: ["mana", "buff"],
            description: "Increases a random alive ally accuracy/evasion/focus/resist/presence for one turn",
            code() {
                const target = randTarget(unitFilter(this.team, '', false), 1, true);
                logAction(`${this.name} increased the luck of ${target[0].name}`, "buff")
                new Modifier("Lucky Aura", "Increases accuracy/evasion/focus/resist/presence",
                    { caster: this, target: this, duration: 2, properties: ["mystic", "buff"], stats: { accuracy: 25, evasion: 45, focus: 35, resist: 40, presence: 40 }, listeners: { turnStart: true }, passive: true },
                    function() { this.changeTarget(randTarget(unitFilter(this.team, '', false).filter(u => u !== this.vars.caster), 1, true)[0]) },
                    function (context) { if (context.unit === this.vars.caster) this.changeTarget(randTarget(unitFilter(this.team, '', false).filter(u => u !== this.vars.caster), 1, true)[0]) },
                );
            }
        },
        {
            name: "Luck Arrow",
            properties: ["mystic", "mana", "buff", "debuff"],
            description: "Reduce max mana by 40 and base mana regen by 8\nOn hit with any attack, gives self advantage to next few attacks/debuffs depending on chance and chance to give disadvantage to target's next few attacks/debuffs, 1% chance to fail to give advantage",
            code() {
                this.mana = (this.base.mana -= 40);
                this.base.manaRegen -= 8;
                resetStat(this, ['manaRegen']);
                new Modifier("Luck Arrow", "On hit with any attack, gives self advantage to next few attacks/debuffs depending on chance and chance to give disadvantage to target's next few attacks/debuffs, 1% chance to fail to give advantage",
                    { caster: this, target: this, properties: ["mystic", "mana", "buff", "debuff"], listeners: { singleDamage: true }, cancelListeners: ['singleDamage'], passive: true },
                    function() {},
                    function(context) {
                        if (context.event === "singleDamage") {
                            let mod = modifiers.find(m => m.name === "Luck Arrow buff" && m.vars.caster === this.vars.caster), will = resistDebuff(this.vars.caster, [context.defender]);
                            mod ? (mod.vars.duration += will[0] < 2 ? 0 : will[0] > 99 ? 7 : Math.floor(will[0]/33) + 1) :
                            new Modifier("Luck Arrow buff", "Gives advantage to next few attacks/debuffs",
                                { caster: this.vars.caster, target: this.vars.caster, duration: will[0] < 2 ? 0 : will[0] > 99 ? 7 : Math.floor(will[0]/33) + 1, properties: ["mystic", "buff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'] },
                                function() { return !this.vars.duration },
                                function(context) {
                                    if (!this.vars.applied) return;
                                    if (context.attacker === this.vars.caster) this.vars.duration--, (context.calcMods.all ??= { reroll: 0 }).reroll++;
                                    return this.vars.duration <= 0;
                                }
                            );
                            mod = modifiers.find(m => m.name === "Luck Arrow debuff" && m.vars.target === context.defender);
                            will = resistDebuff(this.vars.caster, [context.defender]);
                            mod ? (mod.vars.duration += will[0] > 99 ? 7 : Math.floor(will[0]/25)) :
                            new Modifier("Luck Arrow debuff", "Gives disadvantage to target's next few attacks/debuffs",
                                { caster: this.vars.caster, target: context.defender, duration: will[0] > 99 ? 7 : Math.floor(will[0]/25), properties: ["mystic", "debuff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'] },
                                function() { return !this.vars.duration },
                                function(context) {
                                    if (this.vars.applied && context.attacker === this.vars.target) this.vars.duration--, context.calcMods.all ? context.calcMods.all.reroll = (context.calcMods.all.reroll || 0) - 1 : context.calcMods.all = { reroll: -1 };
                                    return this.vars.duration <= 0;
                                }
                            )
                        }
                    }
                )
            }
        }
    ]
}

FourArcher.defaultSkills = [
    { category: 'special', name: 'Rebound Arc' },
    { category: 'basic', name: 'Perfect Shot' },
    { category: 'secondary', name: 'Lucky Aura' },
    { category: 'passive', name: 'Unnatural Luck' },
    { category: 'augment', name: 'Luck Arrow' }
];