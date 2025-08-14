// --- Globaler Zustand für Spieldaten ---
let parsedCompoundData = {};
let allParsedCompounds = [];
let allFormulas = [];
let dataInitializationError = false;

// *** Asynchrone Initialisierungsfunktion mit Fehlerbehandlung ***
async function initializeCompoundData() {
    dataInitializationError = false;
    const startButtons = document.querySelectorAll('#start-screen button');

    // Deaktiviere Start-Buttons, während die Daten geladen werden
    startButtons.forEach(button => {
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
    });

    try {
        const response = await fetch('compounds.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const compoundData = await response.json();

        parsedCompoundData = compoundData; // Die Daten sind bereits im richtigen Format
        allParsedCompounds = [];
        for (const category in parsedCompoundData) {
            if (parsedCompoundData.hasOwnProperty(category)) {
                allParsedCompounds = allParsedCompounds.concat(parsedCompoundData[category]);
            }
        }

        allFormulas = [...new Set(allParsedCompounds.map(c => c.formula).concat([
            "H₂O", "O₂", "N₂", "H₂", "C₆H₁₂O₆", "FeCl₂", "AgNO₃", "H₂O₂", "SO₂", "P₄O₁₀", "NO₂"
        ]))];

        console.log("Verbindungsdaten erfolgreich geladen und verarbeitet. Anzahl Verbindungen:", allParsedCompounds.length);

        // Aktiviere die Start-Buttons wieder
        startButtons.forEach(button => {
            button.disabled = false;
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
        });

    } catch (error) {
        dataInitializationError = true;
        console.error("Fehler beim Laden der Verbindungsdaten:", error);
        const errorMsgElement = document.getElementById('start-error-message');
        if (errorMsgElement) {
            errorMsgElement.textContent = "Fehler beim Laden der Spieldaten. Bitte die Seite neu laden.";
            errorMsgElement.classList.remove('hidden');
        }
    }
}

// Initialisiere die Daten, sobald das DOM geladen ist
document.addEventListener('DOMContentLoaded', initializeCompoundData);

// --- Spiel Zustand ---
let players = []; let currentRound = 0; const totalRounds = 10; let currentSalt = null; let currentCardFormula = null; let cardVisible = false; let cardTimeout = null; let cardSequence = []; let cardSequenceIndex = 0; let gameActive = false; let grabCooldown = false; let roundSalts = [];
let isSinglePlayer = false;

// --- DOM Elemente ---
const startScreen = document.getElementById('start-screen');
const gameArea = document.getElementById('game-area');
const saltNameDisplay = document.getElementById('salt-name-display');
const handsContainer = document.getElementById('hands-container');
const cardElement = document.getElementById('card');
const roundDisplay = document.getElementById('round-display');
const messageBox = document.getElementById('message-box');
const endScreen = document.getElementById('end-screen');
const podiumContainer = document.getElementById('podium-container');
const singlePlayerResult = document.getElementById('single-player-result');
const startErrorMessage = document.getElementById('start-error-message');

// --- Hilfsfunktionen ---
function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
function showMessage(text, duration = 1000) { messageBox.textContent = text; messageBox.style.display = 'flex'; setTimeout(() => { messageBox.style.display = 'none'; }, duration); }
function updateScores() { players.forEach(player => { const scoreElement = document.getElementById(`score-${player.id}`); if (scoreElement) { scoreElement.textContent = isSinglePlayer ? `Punkte: ${player.score}` : `P${player.id.substring(1)}: ${player.score}`; } }); }
function updateRoundDisplay() { roundDisplay.textContent = `Runde: ${currentRound} / ${totalRounds}`; }

// --- Spiel Logik ---
function startGame(numPlayers) {
    console.log(`startGame(${numPlayers}) aufgerufen.`);
     if (dataInitializationError) { console.error("Spielstart verhindert, da Dateninitialisierung fehlgeschlagen ist."); return; }
    startErrorMessage.classList.add('hidden');
    const selectedCategories = []; const checkboxes = document.querySelectorAll('#topic-selection input[type="checkbox"]:checked'); checkboxes.forEach(checkbox => { selectedCategories.push(checkbox.value); }); console.log("Ausgewählte Kategorien:", selectedCategories);
    if (selectedCategories.length === 0) { console.log("Keine Kategorie ausgewählt."); startErrorMessage.textContent = "Bitte wähle mindestens ein Thema aus!"; startErrorMessage.classList.remove('hidden'); return; }
    let activeCompounds = []; selectedCategories.forEach(category => { if (parsedCompoundData[category]) { activeCompounds = activeCompounds.concat(parsedCompoundData[category]); } else { console.warn(`Kategorie "${category}" nicht in parsedCompoundData gefunden.`); } }); console.log("Anzahl aktiver Verbindungen:", activeCompounds.length);
     if (activeCompounds.length < totalRounds) { console.log("Nicht genügend Verbindungen."); startErrorMessage.textContent = `Nicht genügend Verbindungen (${activeCompounds.length}) für ${totalRounds} Runden in den gewählten Themen. Bitte mehr Themen wählen.`; startErrorMessage.classList.remove('hidden'); return; }
    console.log(`Starte Spiel mit ${numPlayers} Spielern und ${activeCompounds.length} aktiven Verbindungen.`); isSinglePlayer = (numPlayers === 1); startScreen.style.display = 'none'; gameArea.classList.remove('hidden'); players = []; currentRound = 0; gameActive = true; grabCooldown = false; handsContainer.innerHTML = ''; endScreen.style.display = 'none'; podiumContainer.style.display = 'none'; singlePlayerResult.style.display = 'none';
    const multiPlayerPositions = ['tl', 'tr', 'bl', 'br']; const handEmojis = ['✋🏻', '✋🏼', '✋🏽', '✋🏾', '✋🏿'];
    if (isSinglePlayer) { const playerId = 'p1'; const position = 'single'; players.push({ id: playerId, score: 0, position: position }); const hand = document.createElement('div'); hand.id = playerId; hand.classList.add('hand', `hand-${position}`); hand.textContent = handEmojis[0]; hand.dataset.playerId = playerId; hand.addEventListener('touchstart', handleGrab, { passive: false }); hand.addEventListener('mousedown', handleGrab); handsContainer.appendChild(hand); const scoreElement = document.createElement('div'); scoreElement.id = `score-${playerId}`; scoreElement.classList.add('player-score', `score-${position}`); scoreElement.textContent = `Punkte: 0`; handsContainer.appendChild(scoreElement); }
    else { for (let i = 0; i < numPlayers; i++) { const playerId = `p${i + 1}`; const position = multiPlayerPositions[i]; players.push({ id: playerId, score: 0, position: position }); const hand = document.createElement('div'); hand.id = playerId; hand.classList.add('hand', `hand-${position}`); hand.textContent = handEmojis[i % handEmojis.length]; hand.dataset.playerId = playerId; hand.addEventListener('touchstart', handleGrab, { passive: false }); hand.addEventListener('mousedown', handleGrab); handsContainer.appendChild(hand); const scoreElement = document.createElement('div'); scoreElement.id = `score-${playerId}`; scoreElement.classList.add('player-score', `score-${position}`); scoreElement.textContent = `P${i + 1}: 0`; handsContainer.appendChild(scoreElement); } }
    roundSalts = shuffleArray([...activeCompounds]).slice(0, totalRounds); console.log("Runden-Verbindungen ausgewählt:", roundSalts.length);
    console.log("Spiel initialisiert. Starte erste Runde."); setTimeout(nextRound, 500);
 }

function nextRound() {
    if (!gameActive) return; currentRound++; console.log(`Starte Runde ${currentRound}`); updateRoundDisplay();
    if (currentRound > totalRounds) { endGame(); return; }
    if (!roundSalts || roundSalts.length === 0 || currentRound > roundSalts.length) { console.error("Fehler: Ungültiger Zugriff auf roundSalts in nextRound."); gameActive = false; return; }
    currentSalt = roundSalts[currentRound - 1];
    if (!currentSalt) { console.error(`Fehler: Kein currentSalt für Runde ${currentRound} gefunden.`); gameActive = false; return; }
    saltNameDisplay.textContent = currentSalt.name; console.log(`Aktuelles Salz: ${currentSalt.name} (Formel: ${currentSalt.formula})`);
    cardSequence = generateCardSequence(currentSalt.formula); cardSequenceIndex = 0; cardVisible = false; cardElement.classList.remove('visible');
    cardElement.innerHTML = ''; // Karte vor dem Start der Sequenz leeren
    console.log("Starte Karten-Zyklus..."); scheduleNextCard();
}
function generateCardSequence(correctFormula) {
    let sequence = [correctFormula]; let attempts = 0; const availableWrongFormulas = allFormulas.filter(f => f !== correctFormula);
    while (sequence.length < 5 && attempts < 100) { if (availableWrongFormulas.length === 0) break; const randomIndex = Math.floor(Math.random() * availableWrongFormulas.length); const randomFormula = availableWrongFormulas[randomIndex]; if (!sequence.includes(randomFormula)) { sequence.push(randomFormula); } attempts++; }
    while (sequence.length < 5 && availableWrongFormulas.length > 0) { const randomFormula = availableWrongFormulas[Math.floor(Math.random() * availableWrongFormulas.length)]; sequence.push(randomFormula); }
    while (sequence.length < 5) { sequence.push(correctFormula); } return shuffleArray(sequence);
}
function scheduleNextCard() {
    if (!gameActive || cardSequenceIndex >= cardSequence.length) { if (gameActive && cardSequenceIndex >= cardSequence.length) { console.log("Karten-Sequenz beendet, niemand hat richtig geraten."); setTimeout(nextRound, 500); } return; }
    if (cardVisible) { cardElement.classList.remove('visible'); cardVisible = false; currentCardFormula = null; cardTimeout = setTimeout(showCard, 1000); } else { showCard(); }
}
function showCard() {
    if (!gameActive || cardSequenceIndex >= cardSequence.length) return; currentCardFormula = cardSequence[cardSequenceIndex];
    const formattedFormula = currentCardFormula.replace(/(\d+)/g, '<sub>$1</sub>'); cardElement.innerHTML = formattedFormula;
    cardElement.classList.add('visible'); cardVisible = true; console.log(`Zeige Karte: ${currentCardFormula} (formatiert: ${formattedFormula})`);
    cardTimeout = setTimeout(() => { if (cardVisible) { cardElement.classList.remove('visible'); cardElement.innerHTML = ''; cardVisible = false; currentCardFormula = null; console.log("Karte ausgeblendet."); cardSequenceIndex++; scheduleNextCard(); } }, 3000);
}

// *** Angepasste handleGrab Funktion (Punktevergabe) ***
function handleGrab(event) {
    event.preventDefault(); if (!gameActive || !cardVisible || grabCooldown) { console.log("Greifen nicht möglich..."); return; } grabCooldown = true;
    const handElement = event.currentTarget; const playerId = handElement.dataset.playerId; const player = players.find(p => p.id === playerId); if (!player) return; console.log(`${playerId} versucht zu greifen: ${currentCardFormula}`); handElement.classList.add('grabbing');
    const correct = currentCardFormula === currentSalt.formula;
    cardElement.classList.remove('visible');
    cardElement.innerHTML = ''; // Karte nach dem Greifen leeren
    cardVisible = false;
    clearTimeout(cardTimeout);
    if (correct) {
        player.score += 1; // +1 Punkt
        showMessage("✅"); console.log(`${playerId} korrekt! Score: ${player.score}`); updateScores();
        setTimeout(() => { handElement.classList.remove('grabbing'); grabCooldown = false; nextRound(); }, 500);
    }
    else {
        player.score -= 1; // -1 Punkt
        showMessage("❌"); console.log(`${playerId} falsch! Score: ${player.score}`); updateScores();
        setTimeout(() => { handElement.classList.remove('grabbing'); grabCooldown = false; cardSequenceIndex++; scheduleNextCard(); }, 500);
    }
}
function endGame() {
    console.log("Spielende!"); gameActive = false; clearTimeout(cardTimeout); cardElement.classList.remove('visible'); saltNameDisplay.textContent = "Spiel vorbei!";
    if (isSinglePlayer) { const finalScore = players[0].score; singlePlayerResult.textContent = `Dein Ergebnis: ${finalScore} Punkte`; singlePlayerResult.style.display = 'block'; podiumContainer.style.display = 'none'; endScreen.querySelector('h2').textContent = "Spiel beendet!"; }
    else { endScreen.querySelector('h2').textContent = "And the winner is…"; podiumContainer.style.display = 'flex'; singlePlayerResult.style.display = 'none'; players.sort((a, b) => b.score - a.score); let rank = 0; let lastScore = Infinity; let playersWithRank = []; players.forEach((player, index) => { if (player.score < lastScore) { rank = index + 1; } if (rank <= 3) { playersWithRank.push({ player: player, rank: rank }); } lastScore = player.score; }); podiumContainer.innerHTML = ''; const podiumSlots = [null, null, null]; playersWithRank.forEach(item => { const player = item.player; const currentRank = item.rank; const placeDiv = document.createElement('div'); placeDiv.classList.add('podium-place', `podium-rank-${currentRank}`); if (currentRank === 1) { const crownSpan = document.createElement('span'); crownSpan.classList.add('crown'); crownSpan.textContent = '👑'; placeDiv.appendChild(crownSpan); } const nameSpan = document.createElement('span'); nameSpan.classList.add('player-name'); nameSpan.textContent = `Spieler ${player.id.substring(1)}`; placeDiv.appendChild(nameSpan); const scoreSpan = document.createElement('span'); scoreSpan.classList.add('player-score-final'); scoreSpan.textContent = `${player.score} Punkte`; placeDiv.appendChild(scoreSpan); if (currentRank === 1) podiumSlots[1] = placeDiv; else if (currentRank === 2) podiumSlots[0] = placeDiv; else if (currentRank === 3) podiumSlots[2] = placeDiv; }); podiumSlots.forEach((slot, index) => { if (slot) { podiumContainer.appendChild(slot); } else { const emptyDiv = document.createElement('div'); if (index === 0) emptyDiv.classList.add('podium-place', 'podium-rank-2', 'podium-empty'); else if (index === 1) emptyDiv.classList.add('podium-place', 'podium-rank-1', 'podium-empty'); else if (index === 2) emptyDiv.classList.add('podium-place', 'podium-rank-3', 'podium-empty'); podiumContainer.appendChild(emptyDiv); } }); }
    gameArea.classList.add('hidden'); endScreen.style.display = 'flex';
}
function restartGame() {
    console.log("Neustart des Spiels."); endScreen.style.display = 'none'; startScreen.style.display = 'flex'; startErrorMessage.classList.add('hidden');
}
document.body.addEventListener('touchmove', function(event) { if (gameActive) { event.preventDefault(); } }, { passive: false });
