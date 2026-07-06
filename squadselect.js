import { DexSoldier } from './unit/dexSoldier.js';
import { FourArcher } from './unit/fourArcher.js';
import { Mannequin } from './unit/mannequin.js';
import { Silhouette } from './unit/silhouette.js';
import { setUnit, sleep, unitFilter, Modifier, handleEvent, removeModifier, basicModifier, logAction, resetStat, regenerateResources, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, modifiers, currentUnit, currentAction, elements, eventState } from './combatDictionary.js';
import { Unit, createUnit, cloneUnit, allUnits } from './unit/unit.js';

const availableUnits = [DexSoldier, FourArcher, Mannequin, Silhouette];

let selectedUnits = [];
let currentEditingUnit = null;
let currentEditingPosition = null;

const categoryColors = {
    special: '#ff9800',   // Orange
    basic: '#4caf50',     // Green
    secondary: '#2196f3', // Blue
    passive: '#9c27b0',   // Purple
    augment: '#f44336'    // Red
};

function initUnitSelection() {
    const roster = document.getElementById('unit-roster');
    const selectedContainer = document.getElementById('selected-units');
    const countDisplay = selectedContainer.querySelector('h4');
    
    roster.innerHTML = '';
    selectedContainer.innerHTML = '<h4>Selected Units (max of 6, 4 recommended)</h4>';
    selectedUnits = [];
    
    availableUnits.forEach(unit => {
        const card = document.createElement('div');
        card.className = 'unit-card';
        card.dataset.unit = unit.name;
        card.innerHTML = `<strong>${unit.name}</strong>`;
        
        card.addEventListener('click', () => {
            updateInfoDisplay(unit);
            if (selectedUnits.length >= 6 && !card.classList.contains('selected')) {
                showMessage('Maximum 6 units allowed!', 'warning', 'selection');
                return;
            }
            
            card.classList.toggle('selected');
            if (card.classList.contains('selected')) {
                const isMidline = unit.base.position === 'mid';
                const unitConfig = {
                    id: crypto.randomUUID(),
                    template: unit,
                    skills: isMidline 
                        ? { front: getDefaultSkills(unit, 'front'), back: getDefaultSkills(unit, 'back') }
                        : getDefaultSkills(unit),
                    startingPosition: isMidline ? 'back' : unit.base.position 
                };
                selectedUnits.push(unitConfig);
                card.dataset.configId = unitConfig.id; // FIX: Assign ID immediately
            } else {
                selectedUnits = selectedUnits.filter(u => u.id !== card.dataset.configId);
                delete card.dataset.configId; // FIX: Clear ID on deselect so it can be re-selected
            }
            
            countDisplay.textContent = `Selected Units (${selectedUnits.length}/6)`;
            renderSelectedUnits();
        });
        roster.appendChild(card);
    });

    document.getElementById('start-with-selected').addEventListener('click', () => {
        if (selectedUnits.length === 0) {
            showMessage('Please select at least 1 unit!', 'error', 'selection');
            return;
        }
        let frontcheck = true;
        for (const unit of selectedUnits) {
            if (unit.startingPosition === "front") {
                frontcheck = false;
                break;
            }
        }
        if (frontcheck) {
            showMessage('Please select at least 1 non-backline unit!', 'error', 'selection');
            return;
        }
        startCombatWithSelected();
    });
}

function getAllSkills(unitTemplate) {
    let allSkills = [];
    for (const category in unitTemplate.skills) {
        if (Array.isArray(unitTemplate.skills[category])) {
            allSkills.push(...unitTemplate.skills[category]);
        } else if (unitTemplate.skills[category]) {
            allSkills.push(unitTemplate.skills[category]);
        }
    }
    return allSkills;
}

function getDefaultSkills(unitTemplate, position = null) {
    if (unitTemplate.base.position === 'mid' && position) {
        const key = `${position}DefaultSkills`;
        if (unitTemplate[key] && Array.isArray(unitTemplate[key])) {
            return resolveDefaultSkills(unitTemplate, unitTemplate[key]);
        }
        return [];
    }
    if (unitTemplate.defaultSkills && Array.isArray(unitTemplate.defaultSkills)) {
        return resolveDefaultSkills(unitTemplate, unitTemplate.defaultSkills);
    }
    return [];
}

function resolveDefaultSkills(template, defaultsArray) {
    return defaultsArray.map(def => {
        const categorySkills = template.skills[def.category];
        if (!categorySkills) return null;
        const skillsArray = Array.isArray(categorySkills) ? categorySkills : [categorySkills];
        return skillsArray.find(s => s.name === def.name);
    }).filter(Boolean);
}

function getActiveSkillsArray() {
    if (currentEditingPosition) {
        return currentEditingUnit.skills[currentEditingPosition];
    }
    return currentEditingUnit.skills;
}

function openSkillSelection(unitConfig) {
    currentEditingUnit = unitConfig;
    currentEditingPosition = unitConfig.template.base.position === 'mid' ? unitConfig.startingPosition : null;
    
    const panel = document.getElementById('skill-selection-panel');
    panel.style.display = 'block';
    
    const unitNameHeader = document.getElementById('skill-unit-name');
    unitNameHeader.textContent = `${unitConfig.template.name} - Skill Setup`;
    
    const oldToggle = document.getElementById('skill-pos-toggle');
    if (oldToggle) oldToggle.remove();
    
    if (unitConfig.template.base.position === 'mid') {
        const toggleDiv = document.createElement('div');
        toggleDiv.id = 'skill-pos-toggle';
        toggleDiv.style.cssText = 'text-align: center; margin-bottom: 15px;';
        toggleDiv.innerHTML = `
            <p style="margin: 0 0 5px 0; font-size: 12px; color: #aaa;">Currently adding skills to:</p>
            <button id="pos-front-btn" style="padding: 5px 15px; background: ${currentEditingPosition === 'front' ? '#060' : '#555'}; color: white; border: none; cursor: pointer; border-radius: 4px; margin-right: 10px;">Frontline</button>
            <button id="pos-back-btn" style="padding: 5px 15px; background: ${currentEditingPosition === 'back' ? '#060' : '#555'}; color: white; border: none; cursor: pointer; border-radius: 4px;">Backline</button>
        `;
        unitNameHeader.after(toggleDiv);
        
        document.getElementById('pos-front-btn').onclick = () => {
            currentEditingPosition = 'front';
            openSkillSelection(unitConfig);
        };
        document.getElementById('pos-back-btn').onclick = () => {
            currentEditingPosition = 'back';
            openSkillSelection(unitConfig);
        };
    }
    
    renderSkillRoster();
    renderSelectedSkills();
    
    document.getElementById('confirm-skills').onclick = () => {
        const maxSlots = currentEditingUnit.template.skillSlots || 5;
        const positionsToCheck = currentEditingUnit.template.base.position === 'mid' ? ['front', 'back'] : [null];
        
        for (const pos of positionsToCheck) {
            const skills = pos ? currentEditingUnit.skills[pos] : currentEditingUnit.skills;
            const posLabel = pos ? ` for ${pos}line` : '';
            
            if (skills.length > maxSlots) {
                showMessage(`You have selected ${skills.length} skills${posLabel}, but the maximum is ${maxSlots}.`, 'error', 'selection');
                return;
            }
            
            const names = skills.map(s => s.name);
            const duplicateNames = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
            if (duplicateNames.length > 0) {
                showMessage(`Duplicate skill names${posLabel}: ${duplicateNames.join(', ')}.`, 'error', 'selection');
                return;
            }
            
            const categories = skills.map(s => getSkillCategory(currentEditingUnit.template, s));
            const duplicateCategories = [...new Set(categories.filter((cat, index) => categories.indexOf(cat) !== index))];
            if (duplicateCategories.length > 0) {
                showMessage(`Duplicate skill types${posLabel}: ${duplicateCategories.join(', ')}.`, 'error', 'selection');
                return;
            }
        }
        
        panel.style.display = 'none';
        renderSelectedUnits();
    };
    
    document.getElementById('cancel-skills').onclick = () => {
        panel.style.display = 'none';
    };
    
    document.getElementById('reset-defaults').onclick = () => {
        if (currentEditingPosition) {
            currentEditingUnit.skills[currentEditingPosition] = getDefaultSkills(currentEditingUnit.template, currentEditingPosition);
        } else {
            currentEditingUnit.skills = getDefaultSkills(currentEditingUnit.template);
        }
        renderSelectedSkills();
        renderSkillRoster();
    };
}

function getSkillCategory(template, skillObj) {
    for (const cat in template.skills) {
        const skills = Array.isArray(template.skills[cat]) ? template.skills[cat] : [template.skills[cat]];
        if (skills.includes(skillObj)) return cat;
    }
    return 'unknown';
}

function renderSkillRoster() {
    const roster = document.getElementById('skill-roster');
    roster.innerHTML = '';
    const activeSkills = getActiveSkillsArray();

    for (const category of ['special', 'basic', 'secondary', 'passive', 'augment']) {
        const skillsInCategory = currentEditingUnit.template.skills[category];
        if (!skillsInCategory) continue;
        
        const skillsArray = Array.isArray(skillsInCategory) ? skillsInCategory : [skillsInCategory];
        if (skillsArray.length === 0) continue;

        const header = document.createElement('h4');
        header.style.cssText = `color: ${categoryColors[category]}; text-transform: uppercase; margin: 15px 0 5px 0; border-bottom: 1px solid ${categoryColors[category]}; padding-bottom: 4px; font-size: 14px;`;
        header.textContent = category;
        roster.appendChild(header);

        skillsArray.forEach(skill => {
            const requiredPos = skill.cost?.position;
            if (currentEditingPosition && requiredPos && requiredPos !== currentEditingPosition) {
                return; 
            }

            const isAlreadySelected = activeSkills.includes(skill); 
            
            const skillDiv = document.createElement('div');
            skillDiv.style.cssText = `padding: 8px; margin: 5px 0; background: ${isAlreadySelected ? '#222' : '#333'}; border-left: 4px solid ${categoryColors[category]}; border-radius: 4px; cursor: ${isAlreadySelected ? 'not-allowed' : 'pointer'}; opacity: ${isAlreadySelected ? '0.5' : '1'}; transition: background 0.2s;`;
            
            const descText = skill.description ? skill.description.replace(/\n/g, '<br>') : '';
            skillDiv.innerHTML = `<strong>${skill.name}</strong><br><small style="color: #ccc;">${descText}</small>`;
            
            if (!isAlreadySelected) {
                skillDiv.addEventListener('mouseenter', () => skillDiv.style.background = '#444');
                skillDiv.addEventListener('mouseleave', () => skillDiv.style.background = '#333');
                skillDiv.addEventListener('click', () => {
                    activeSkills.push(skill);
                    renderSkillRoster();
                    renderSelectedSkills();
                });
            }
            roster.appendChild(skillDiv);
        });
    }
}

function renderSelectedSkills() {
    const list = document.getElementById('selected-skills-list');
    const countDisplay = document.getElementById('selected-skills-count');
    const maxSlots = currentEditingUnit.template.skillSlots || 5;
    
    list.innerHTML = '';
    
    // If it's a midline unit, show BOTH Front and Back loadouts simultaneously
    if (currentEditingUnit.template.base.position === 'mid') {
        countDisplay.textContent = `Skill Loadouts (${maxSlots} slots each)`;
        
        // --- FRONTLINE LIST ---
        const frontHeader = document.createElement('h4');
        frontHeader.style.cssText = 'color: #4caf50; margin: 10px 0 5px 0; border-bottom: 1px solid #4caf50; padding-bottom: 4px;';
        frontHeader.textContent = `Frontline (${currentEditingUnit.skills.front.length}/${maxSlots})`;
        list.appendChild(frontHeader);
        
        if (currentEditingUnit.skills.front.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.style.cssText = 'color: #888; text-align: center; font-size: 12px; margin: 5px 0;';
            emptyMsg.textContent = 'No frontline skills selected';
            list.appendChild(emptyMsg);
        } else {
            currentEditingUnit.skills.front.forEach((skill, index) => {
                list.appendChild(createSkillItem(skill, 'front', index));
            });
        }
        
        // --- BACKLINE LIST ---
        const backHeader = document.createElement('h4');
        backHeader.style.cssText = 'color: #2196f3; margin: 15px 0 5px 0; border-bottom: 1px solid #2196f3; padding-bottom: 4px;';
        backHeader.textContent = `Backline (${currentEditingUnit.skills.back.length}/${maxSlots})`;
        list.appendChild(backHeader);
        
        if (currentEditingUnit.skills.back.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.style.cssText = 'color: #888; text-align: center; font-size: 12px; margin: 5px 0;';
            emptyMsg.textContent = 'No backline skills selected';
            list.appendChild(emptyMsg);
        } else {
            currentEditingUnit.skills.back.forEach((skill, index) => {
                list.appendChild(createSkillItem(skill, 'back', index));
            });
        }
    } else {
        // Standard unit (non-midline)
        countDisplay.textContent = `Selected Skills (${currentEditingUnit.skills.length}/${maxSlots})`;
        if (currentEditingUnit.skills.length === 0) {
            list.innerHTML = '<p style="color: #888; text-align: center;">No skills selected (Not Recommended)</p>';
            return;
        }
        currentEditingUnit.skills.forEach((skill, index) => {
            list.appendChild(createSkillItem(skill, null, index));
        });
    }
}

// Helper function to generate the HTML for a selected skill card
function createSkillItem(skill, position, index) {
    const category = getSkillCategory(currentEditingUnit.template, skill);
    const color = categoryColors[category] || '#888';
    
    const skillDiv = document.createElement('div');
    skillDiv.style.cssText = `padding: 8px; margin: 5px 0; background: #1a1a1a; border-left: 4px solid ${color}; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;`;
    
    skillDiv.innerHTML = `
        <span>
            <strong>${skill.name}</strong> 
            <span style="background: ${color}; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; text-transform: uppercase; margin-left: 8px;">${category}</span>
        </span>
        <button style="background: #600; color: white; border: none; padding: 4px 10px; cursor: pointer; border-radius: 4px;">Remove</button>
    `;
    
    skillDiv.querySelector('button').addEventListener('click', () => {
        // Remove from the correct array based on position
        if (position) {
            currentEditingUnit.skills[position].splice(index, 1);
        } else {
            currentEditingUnit.skills.splice(index, 1);
        }
        renderSkillRoster();
        renderSelectedSkills();
    });
    
    return skillDiv;
}

function renderSelectedUnits() {
    const container = document.getElementById('selected-units');
    container.querySelectorAll('.unit-card').forEach(card => card.remove());
    
    selectedUnits.forEach(unitConfig => {
        const card = document.createElement('div');
        card.className = 'unit-card selected';
        
        let positionToggleHTML = '';
        if (unitConfig.template.base.position === 'mid') {
            positionToggleHTML = `
                <div style="margin-top: 8px; display: flex; gap: 5px; justify-content: center;">
                    <button class="pos-btn" data-pos="front" style="padding: 2px 8px; background: ${unitConfig.startingPosition === 'front' ? '#060' : '#555'}; color: white; border: none; cursor: pointer; border-radius: 4px; font-size: 12px;">Front</button>
                    <button class="pos-btn" data-pos="back" style="padding: 2px 8px; background: ${unitConfig.startingPosition === 'back' ? '#060' : '#555'}; color: white; border: none; cursor: pointer; border-radius: 4px; font-size: 12px;">Back</button>
                </div>
            `;
        }

        // FIX: Handle midline units where skills is an object, not an array
        let skillCountHTML = '';
        if (unitConfig.template.base.position === 'mid') {
            const maxSlots = unitConfig.template.skillSlots || 5;
            skillCountHTML = `
                <div style="font-size: 12px; color: #aaa; margin-top: 5px;">Front: ${unitConfig.skills.front.length} / ${maxSlots}</div>
                <div style="font-size: 12px; color: #aaa;">Back: ${unitConfig.skills.back.length} / ${maxSlots}</div>
            `;
        } else {
            skillCountHTML = `<div style="font-size: 12px; color: #aaa; margin-top: 5px;">Skills: ${unitConfig.skills.length} / ${unitConfig.template.skillSlots || 5}</div>`;
        }

        card.innerHTML = `
            <strong>${unitConfig.template.name}</strong>
            ${skillCountHTML}
            ${positionToggleHTML}
        `;
        container.appendChild(card);
        
        if (unitConfig.template.base.position === 'mid') {
            card.querySelectorAll('.pos-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const newPos = btn.dataset.pos;
                    if (unitConfig.startingPosition !== newPos) {
                        unitConfig.startingPosition = newPos;
                        unitConfig.skills[newPos] = unitConfig.skills[newPos].filter(skill => {
                            const reqPos = skill.cost?.position;
                            return !reqPos || reqPos === newPos;
                        });
                        renderSelectedUnits();
                    }
                });
            });
        }

        card.addEventListener('click', () => {
            updateInfoDisplay(unitConfig.template);
            openSkillSelection(unitConfig);
        });
    });
}

function startCombatWithSelected() {
    // 1. Serialize the squad data (Names + Skill Categories to handle duplicate names)
    const squadData = selectedUnits.map(config => {
        const extractSkillInfo = (skill) => ({ 
            name: skill.name, 
            category: getSkillCategory(config.template, skill) 
        });
        
        // Handle midline front/back skills or standard skills
        const skillsData = config.template.base.position === 'mid' 
            ? { 
                front: config.skills.front.map(extractSkillInfo), 
                back: config.skills.back.map(extractSkillInfo) 
              }
            : config.skills.map(extractSkillInfo);
            
        return {
            templateName: config.template.name,
            startingPosition: config.startingPosition,
            skills: skillsData
        };
    });
    
    // 2. Save to localStorage
    localStorage.setItem('pendingSquad', JSON.stringify(squadData));
    
    // 3. Navigate to the combat page
    window.location.href = 'combat.html'; // Change to 'squadproto.html' if that's your file name
}

function updateInfoDisplay(unit) {
    const infoDisplay = document.querySelector('.info-display');
    if (!infoDisplay || !unit) return;
    
    let html = `<div class="left-column"> <h2>${unit.name}</h2> <p>${unit.description}</p> <h4>Stats (Current)</h4>`;
    
    for (const statName of Object.keys(unit.base).filter(s => s !== "elements")) {
        if (['hp', 'stamina', 'mana', 'energy'].includes(statName)) { 
            html += `<div class="stat-line"><span><strong>${statName.charAt(0).toUpperCase() + statName.slice(1)}</strong></span><span>${Math.max(0, unit[statName])} / ${unit.base[statName]}</span></div>`  
        } else if (unit[statName] !== undefined) { 
            html += `<div class="stat-line"><span>${statName.charAt(0).toUpperCase() + statName.slice(1)}</span><span>${unit[statName]}</span></div>`  
        } else if (unit.base[statName] !== undefined) { 
            html += `<div class="stat-line"><span>${statName.charAt(0).toUpperCase() + statName.slice(1)}</span><span>${unit.base[statName]}</span></div>`  
        }
    }
    html += `</div>`;
    
    html += `<div class="right-column"><h3>Skills</h3>`;
    for (const skillName in unit.skills) {
        if (Array.isArray(unit.skills[skillName])) {
            html += `<h4>${skillName} skills</h4>`;
            for (const skill of unit.skills[skillName]) {
                html += `<div class="skill-info-box"><div class="skill-name">${skill.name}</div><p><strong>Description:</strong><br>${skill.description ? skill.description.replace(/\n/g, '<br>') : 'No description available.'}</p></div><hr>`;
            }
        } else {
            const skill = unit.skills[skillName];
            html += `<h4>${skillName} skill</h4><div class="skill-info-box"><div class="skill-name">${skill.name}</div><p><strong>Description:</strong><br>${skill.description ? skill.description.replace(/\n/g, '<br>') : 'No description available.'}</p></div><hr>`;
        }
    }
    infoDisplay.innerHTML = html + '</div>';
}

export function startCombat() {
    document.getElementById('unit-selection-panel').style.display = 'block';
    //document.getElementById('game-controls').style.display = 'none';
    initUnitSelection();
}