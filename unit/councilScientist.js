import { sleep, unitFilter, Modifier, handleEvent, removeModifier, basicModifier, stunModifier, attribCancelMod, logAction, resetStat, regenerateResources, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, modifiers, currentAction, elements, eventState } from '../combatDictionary.js';
import { Unit, allUnits } from './unit.js';

export const CouncilScientist = new Unit("Science Council Member", [1000, 21, 28, 100, 80, 120, 80, 80, 130, "back", 100, 70, 6, , , 80, 9], ["independence/loneliness"]);

CouncilScientist.skills = {
    special: [
        {
            name: "Laser Turret",
            properties: ["physical", "stamina", "techno", "energy", "attack", "dot"],
            cost: { stamina: 10, energy: 15 },
            description: "Attacks a single target with increased attack and accuracy at the end of this and the next 5 turns",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front", false))) },
            code(target) {
                new Modifier("Laser Turret", "Attacks target at end of caster's turn", 
                    { caster: this, target: target[0], duration: 6, properties: ["techno", "attack", "dot"], listeners: { turnEnd: true } },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) attack(this.vars.caster, [this.vars.target], 1, { attack: { bonus: 60 }, accuracy: { bonus: 40 } });
                            this.vars.duration;
                        }
                        return this.vars.duration >= 0;
                    }
                )
            }
        },
        {
            name: "Drone",
            properties: ["techno", "energy", "summon"],
            cost: { energy: 50 },
            description: "Summons a 2-star drone to the frontline for 5 turns. If currently active, refreshes drone duration/HP and returns 10 energy for each turn remaining",
            code() {
                let drone = modifiers.find(m => m.name === "Drone" && m.vars.caster === this);
                if (drone) {
                    resourceChange(this, { stamina: drone.vars.duration * 10 });
                    drone.vars.duration = 5;
                    hpChange(this, [drone], [drone.base.hp]);
                    resourceChange(drone, { stamina: drone.base.stamina, energy: drone.base.energy })
                } else {
                    drone = createUnit({ ...Drone, name: "Deka Drone" }, this.team);
                    drone.skills = droneSkills(this);
                    drone.custom = { ...drone.custom, summoner: this };
                    Object.keys(drone.base).filter(stat => stat !== "position" && stat !== "elements").forEach(stat => { drone.base[stat] = Math.ceil(drone.base[stat] * 1.5) });
                    resetStat(drone, Object.keys(drone.base).filter(s => s !== "position" && s !== "elements" ));
                    if (eventState.unitChange.length) handleEvent('unitChange', { type: 'summon', unit: drone });
                    new Modifier("Drone", "Summon 2-star drone",
                        { caster: this, target: drone, duration: 5, properties: ["techno", "summon"], listeners: { turnEnd: true, unitChange: true }, perm: true },
                        function() {},
                        function(context) {
                            if (context.unit === this.vars.target) {
                                if (context.type === "death") return !(this.vars.perm = this.vars.listeners.unitChange = false);
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
            }
        },
        {
            name: "EMP",
            properties: ["techno", "energy", "debuff", "cancel"],
            cost: { energy: 40 },
            description: "Ends non-passive techno modifiers target is focusing, cancels techno modifiers on target, and disables energy regen for a few turns depending on chance, 1% chance to fail",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front", false))) },
            code(target) {
                const will = resistDebuff(this, target)[0];
                if (will >= 2) attribCancelMod("EMP", { caster: this, target: target[0], duration: will > 99 ? 4 : Math.ceil(will/33), properties: ["techno", "debuff", "cancel"], debuff: (target) => resistDebuff(this, [target])[0] >= 2 }, 'techno');
                else logAction(`${target[0].name} resists the EMP!`, 'miss');
            }
        },
        {
            name: "Backup Power",
            properties: ["physical", "stamina", "energy"],
            cost: { stamina: 30 },
            description: "Recover a lot of energy (~45% max energy)",
            code() {
                resourceChange(this, { energy: 4.5 * this.energyRegen });
                logAction(`${this.name} turns on backup power!`, "buff");
            }
        },
        {
            name: "First Aid",
            properties: ["techno", "energy", "heal"],
            cost: { energy: 50 },
            description: "Heal all allies (~10% max HP)",
            code() { 
                const targets = unitFilter(this.team, '');
                if (eventState.targets.length) handleEvent('targets', { selectedTargets: targets, count: targets.length });
                heal(this, targets, Array(targets.length).fill(1));
            }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["physical", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Increases accuracy/focus/speed and decreases defense/resist/presence for 5 turns",
            code() {
                basicModifier("Pursuit of Knowledge buff", "Accuracy, focus, and speed increase", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { accuracy: 60, focus: 120, speed: 50 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("Pursuit of Knowledge penalty", "Defense, resist, and presence decrease", { caster: this, target: this, duration: 6, properties: ["physical", "penalty"], stats: { defense: -10, resist: -30, presence: -60 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        }
    ],
    basic: [
        {
            name: "Laser Turret",
            properties: ["physical", "techno", "attack", "dot"],
            description: "Attacks a target with increased attack and accuracy at the end of this and the next 5 turns",
            code() {
                new Modifier("Laser Turret", "Attacks target at end of caster's turn", 
                    { caster: this, target: this, duration: 6, properties: ["techno", "attack", "dot"], listeners: { turnEnd: true } },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) attack(this.vars.caster, randTarget(this.vars.caster.team === 'player' ? 'enemy' : 'player'), 1, { attack: { bonus: 30 }, accuracy: { bonus: 40 } });
                            this.vars.duration;
                        }
                        return this.vars.duration >= 0;
                    }
                )
            }
        },
        {
            name: "Drone",
            properties: ["techno", "energy", "summon"],
            cost: { energy: 10 },
            description: "Summons a 1-star drone to the frontline for 3 turns. If currently active, refreshes drone duration/HP and returns 5 energy for each turn remaining",
            code() {
                let drone = modifiers.find(m => m.name === "Drone" && m.vars.caster === this);
                if (drone) {
                    resourceChange(this, { stamina: drone.vars.duration * 5 });
                    drone.vars.duration = 3;
                    hpChange(this, [drone], [drone.base.hp]);
                    resourceChange(drone, { stamina: drone.base.stamina, energy: drone.base.energy })
                } else {
                    drone = createUnit(Drone, this.team);
                    drone.skills = droneSkills(this);
                    drone.custom = { ...drone.custom, summoner: this };
                    if (eventState.unitChange.length) handleEvent('unitChange', { type: 'summon', unit: drone });
                    new Modifier("Drone", "Summon 2-star drone",
                        { caster: this, target: drone, duration: 3, properties: ["techno", "summon"], listeners: { turnEnd: true, unitChange: true }, perm: true },
                        function() {},
                        function(context) {
                            if (context.unit === this.vars.target) {
                                if (context.type === "death") return !(this.vars.perm = this.vars.listeners.unitChange = false);
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
            }
        },
        {
            name: "EMP",
            properties: ["techno", "energy", "debuff", "cancel"],
            cost: { energy: 10 },
            description: "Chance to end non-passive techno modifiers target is focusing, cancel techno modifiers on target, and disables energy regen for 1 turn",
            code() {
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                if (resistDebuff(this, target)[0] >= 25) attribCancelMod("EMP", { caster: this, target: target[0], duration: 1, properties: ["techno", "debuff", "cancel"], debuff: (target) => resistDebuff(this, [target])[0] >= 25 }, 'techno');
                else logAction(`${target[0].name} resists the EMP!`, 'miss');
            }
        },
        {
            name: "Backup Power",
            properties: ["physical", "stamina", "energy"],
            cost: { stamina: 10 },
            description: "Recover a lot of energy (~25% max energy)",
            code() {
                resourceChange(this, { energy: 2.5 * this.energyRegen });
                logAction(`${this.name} turns on backup power!`, "buff");
            }
        },
        {
            name: "First Aid",
            properties: ["techno", "energy", "heal"],
            cost: { energy: 10 },
            description: "Heal lowest hp ally (~15% max HP)",
            code() { heal(this, unitByStat(unitFilter(this.team, ''), 'hp', 'percent', false), [1.5]) }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["physical", "buff", "penalty"],
            description: "Increases accuracy/focus/speed and decreases defense/resist/presence for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                let mod = modifiers.find(m => m.name.includes("Pursuit of Knowledge") && m.vars.caster === this);
                if (mod) {
                    this.previousAction[0] = false;
                    mod.vars.duration = 3;
                    logAction(`${this.name} refreshes ${mod.name}`);
                    mod = modifiers.find(m => m !== mod && m.name.includes("Pursuit of Knowledge") && m.vars.caster === this)
                    if (mod) mod.vars.duration = 3, logAction(`${this.name} refreshes ${mod.name}`);
                } else {
                    basicModifier("Pursuit of Knowledge buff", "Accuracy, focus, and speed increase", { caster: this, target: this, duration: 3, properties: ["physical", "buff"], stats: { accuracy: 30, focus: 100, speed: 40 }, listeners: { turnEnd: true }, focus: true });
                    basicModifier("Pursuit of Knowledge penalty", "Defense, resist, and presence decrease", { caster: this, target: this, duration: 3, properties: ["physical", "penalty"], stats: { defense: -5, resist: -20, presence: -40 }, listeners: { turnEnd: true }, focus: true, penalty: true });
                }
            }
        }
    ],
    secondary: [
        {
            name: "Laser Turret",
            properties: ["attack", "dot"],
            description: "Attacks a target with increased attack and accuracy at the end of this and the next 2 turns",
            code() {
                new Modifier("Laser Turret", "Attacks target at end of caster's turn", 
                    { caster: this, target: this, duration: 3, properties: ["techno", "attack", "dot"], listeners: { turnEnd: true } },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) attack(this.vars.caster, randTarget(this.vars.caster.team === 'player' ? 'enemy' : 'player'), 1, { attack: { bonus: 30 }, accuracy: { bonus: 40 } });
                            this.vars.duration;
                        }
                        return this.vars.duration >= 0;
                    }
                )
            }
        },
        {
            name: "Backup Power",
            properties: ["physical", "energy"],
            description: "Recover some energy (~15% max energy)",
            code() {
                resourceChange(this, { energy: 1.5 * this.energyRegen });
                logAction(`${this.name} turns on backup power!`, "buff");
            }
        },
        {
            name: "First Aid",
            properties: ["techno", "heal"],
            description: "Heal lowest hp ally (~10% max HP)",
            code() { heal(this, unitByStat(unitFilter(this.team, ''), 'hp', 'percent', false), [1]) }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["buff", "penalty"],
            description: "Increases focus/speed and decreases resist/presence for 1 turn",
            code() {
                basicModifier("Pursuit of Knowledge buff", "Focus and speed increase", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { focus: 80, speed: 30 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("Pursuit of Knowledge penalty", "Resist and presence decrease", { caster: this, target: this, duration: 2, properties: ["physical", "penalty"], stats: { resist: -10, presence: -30 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        }
    ],
    passive: [
        {
            name: "Laser Turret",
            properties: ["attack", "dot"],
            reduction: { energy: 10 },
            description: "Attacks a target with increased attack and accuracy at the end of each turn",
            code() {
                new Modifier("Laser Turret", "Attacks a target at end of caster's turn", 
                    { caster: this, target: this, properties: ["techno", "attack", "dot"], listeners: { turnEnd: true }, cancelListeners: ['turnEnd'], reduction: this.skills.passive.reduction, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster && this.vars.applied) attack(this.vars.caster, randTarget(this.vars.caster.team === 'player' ? 'enemy' : 'player'), 1, { attack: { bonus: 30 }, accuracy: { bonus: 40 } }) }
                )
            }
        },
        {
            name: "Drone",
            properties: ["techno", "energy", "summon"],
            reduction: { energy: 20, energyRegen: 2 },
            description: "Summons a 1-star drone to the frontline.",
            code() {
                let drone = createUnit(Drone, this.team);
                drone.skills = droneSkills(this);
                drone.custom = { ...drone.custom, summoner: this };
                if (eventState.unitChange.length) handleEvent('unitChange', { type: 'summon', unit: drone });
                new Modifier("Drone", "Summon 2-star drone",
                    { caster: this, target: drone, properties: ["techno", "summon"], listeners: { unitChange: true, waveChange: true }, reduction: this.skills.passive.reduction, perm: true },
                    function() {},
                    function(context) { if (context.event = 'waveChange' || (context.unit === this.vars.target && context.type === "death")) return !(this.vars.perm = false) },
                    function() {},
                    function() {}
                )
            }
        },
        {
            name: "Backup Power",
            properties: ["physical", "stamina", "energy"],
            reduction: { stamina: 20, staminaRegen: 2 },
            description: "Regen energy (~10% max energy) each turn",
            code() {
                new Modifier("Backup Power", `Regen energy (~10% max energy) each turn`,
                    { caster: this, target: this, properties: ["physical", "energy"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster && this.vars.applied ) resourceChange(this.vars.target, { mana: this.vars.target.manaRegen }) }
                )
            }
        },
        {
            name: "First Aid",
            properties: ["techno", "energy", "heal"],
            reduction: { energy: 10, energyRegen: 1 },
            description: `Heals ally slightly (~5% max HP) at start of turn`,
            code() {
                new Modifier("First Aid", `Heals at start of turn`,
                    { caster: this, target: this, properties: ["techno", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.target) heal(this.vars.caster, [this.vars.target], [.5]) }
                );
            }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["physical", "stamina", "buff", "penalty"],
            description: "Increases focus/speed and decreases resist/presence",
            code() {
                basicModifier("Pursuit of Knowledge buff", "Focus and speed increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { focus: 120, speed: 20 }, passive: true, focus: true });
                basicModifier("Pursuit of Knowledge penalty", "Resist and presence decrease", { caster: this, target: this,properties: ["physical", "penalty"], stats: { resist: -20, presence: -40 }, passive: true, focus: true, penalty: true });
            }
        }
    ],
    augment: [
        {
            name: "Backup Power",
            properties: ["physical", "stamina", "energy"],
            reduction: { stamina: 20, staminaRegen: 2 },
            description: "Regen energy (~15% max energy) each turn",
            code() {
                new Modifier("Backup Power", `Regen energy (~15% max energy) each turn`,
                    { caster: this, target: this, properties: ["physical", "energy"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster && this.vars.applied ) resourceChange(this.vars.target, { mana: this.vars.target.manaRegen * 1.5 }) }
                )
            }
        },
        {
            name: "First Aid",
            properties: ["techno", "energy", "heal"],
            reduction: { energy: 10, energyRegen: 1 },
            description: `Heals ally slightly (~7.5% max HP) at start of turn`,
            code() {
                new Modifier("First Aid", `Heals at start of turn`,
                    { caster: this, target: this, properties: ["techno", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.target) heal(this.vars.caster, [this.vars.target], [.75]) }
                );
            }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["physical", "stamina", "buff", "penalty"],
            description: "Increases accuracy/focus/speed and decreases resist/presence",
            code() {
                basicModifier("Pursuit of Knowledge buff", "Accuracy, focus, and speed increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { accuracy: 30, focus: 120, speed: 30 }, passive: true, focus: true });
                basicModifier("Pursuit of Knowledge penalty", "Resist and presence decrease", { caster: this, target: this,properties: ["physical", "penalty"], stats: { resist: -10, presence: -20 }, passive: true, focus: true, penalty: true });
            }
        }
    ]
}

CouncilScientist.defaultSkills = [
    { category: 'special', name: 'Drone' },
    { category: 'basic', name: 'First Aid' },
    { category: 'secondary', name: 'Backup Power ' },
    { category: 'passive', name: 'Laser Turret' },
    { category: 'augment', name: 'Pursuit of Knowledge' }
];

const Drone = new Unit("Drone", [450, 10, 14, 44, 36, 50, 36, 36, 60, "front", 44, 30, 4, , , 44, 6])

droneSkills = function(unit) {
    const two = unit.skills.special?.name === "Drone";
    const has = n => Object.values(unit.skills).some(s => s?.name === n);
    const list = {
        laser: has("Laser Turret"),
        heal: has("First Aid"),
        disrupt: has("EMP"),
        ...(two ? { recharge: has("Backup Power")} : {})
    }
    const skills = { passive: (two && !list.recharge) ? 'recharge' : 'heal'};
    for (const skill of (two ? ['basic', 'secondary', 'special'] : ['basic', 'special'])) {
        const l = Object.keys(list).filter(s => !list[s] && !Object.values(skills).includes(s));
        skills[skill] = l.length ? l[0] : Object.keys(list).find(s => !Object.values(skills).includes(s));
    }
}