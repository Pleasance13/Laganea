import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, Eraser, Trash2, Download, RefreshCw, Pipette, Palette, PaintBucket, Settings, Sun, Moon } from 'lucide-react';

// ─── Color Utilities ──────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s, v };
}

function hsvToRgb(h, s, v) {
  h /= 360;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function hexToHsv(hex) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}

function hsvToHex(h, s, v) {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

// ─── Custom Color Picker Popup ────────────────────────────────────────────────

const ColorPickerPopup = ({ color, onChange, onClose, darkMode, triggerRef }) => {
  const [hsv, setHsv] = useState(() => hexToHsv(color || '#2D3748'));
  const [hexInput, setHexInput] = useState(color || '#2D3748');
  const sbRef = useRef(null);
  const hueRef = useRef(null);
  const popupRef = useRef(null);
  const dragging = useRef(null);

  // Sync hex display when HSV changes
  useEffect(() => {
    const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
    setHexInput(hex);
    onChange(hex);
  }, [hsv]);

  // Close on outside click — but exclude the trigger button so it can toggle
  useEffect(() => {
    const handler = (e) => {
      const clickedInsidePopup = popupRef.current && popupRef.current.contains(e.target);
      const clickedTrigger = triggerRef && triggerRef.current && triggerRef.current.contains(e.target);
      if (!clickedInsidePopup && !clickedTrigger) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, triggerRef]);

  // Global mouse move / up for drag
  useEffect(() => {
    const onMove = (e) => {
      if (dragging.current === 'sb' && sbRef.current) {
        const rect = sbRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        setHsv(prev => ({ ...prev, s: x, v: 1 - y }));
      }
      if (dragging.current === 'hue' && hueRef.current) {
        const rect = hueRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        setHsv(prev => ({ ...prev, h: x * 360 }));
      }
    };
    const onUp = () => { dragging.current = null; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleSBDown = (e) => {
    dragging.current = 'sb';
    const rect = sbRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setHsv(prev => ({ ...prev, s: x, v: 1 - y }));
  };

  const handleHueDown = (e) => {
    dragging.current = 'hue';
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHsv(prev => ({ ...prev, h: x * 360 }));
  };

  const handleHexInput = (e) => {
    const val = e.target.value;
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      const { r, g, b } = hexToRgb(val);
      setHsv(rgbToHsv(r, g, b));
    }
  };

  // Pure hue color for the SB gradient background
  const pureHue = `hsl(${hsv.h}, 100%, 50%)`;
  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);

  // Indicator position
  const indicatorLeft = `${hsv.s * 100}%`;
  const indicatorTop = `${(1 - hsv.v) * 100}%`;
  const hueLeft = `${(hsv.h / 360) * 100}%`;

  return (
    <div
      ref={popupRef}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: 0,
        zIndex: 200,
        background: darkMode ? '#1e2433' : '#ffffff',
        border: `2px solid ${darkMode ? '#4f46e5' : '#a5b4fc'}`,
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
        padding: 12,
        width: 232,
        userSelect: 'none',
      }}
    >
      {/* SB Square */}
      <div
        ref={sbRef}
        onMouseDown={handleSBDown}
        style={{
          position: 'relative',
          width: '100%',
          height: 156,
          borderRadius: 8,
          background: pureHue,
          cursor: 'crosshair',
          marginBottom: 10,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* White → transparent gradient (saturation) */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, #fff 0%, transparent 100%)',
        }} />
        {/* Transparent → black gradient (value) */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 0%, #000 100%)',
        }} />
        {/* Indicator circle */}
        <div style={{
          position: 'absolute',
          left: indicatorLeft,
          top: indicatorTop,
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: '2.5px solid #fff',
          boxShadow: '0 0 0 1.5px rgba(0,0,0,0.35)',
          backgroundColor: currentHex,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Hue Slider */}
      <div
        ref={hueRef}
        onMouseDown={handleHueDown}
        style={{
          position: 'relative',
          width: '100%',
          height: 14,
          borderRadius: 99,
          background: 'linear-gradient(to right,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)',
          cursor: 'pointer',
          marginBottom: 10,
          flexShrink: 0,
        }}
      >
        {/* Hue thumb */}
        <div style={{
          position: 'absolute',
          left: hueLeft,
          top: '50%',
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '2.5px solid #fff',
          boxShadow: '0 0 0 1.5px rgba(0,0,0,0.35)',
          backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Preview + Hex input + close */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          backgroundColor: currentHex,
          border: '1.5px solid rgba(0,0,0,0.15)',
          flexShrink: 0,
        }} />
        <input
          type="text"
          value={hexInput}
          onChange={handleHexInput}
          maxLength={7}
          spellCheck={false}
          style={{
            flex: 1,
            padding: '5px 8px',
            borderRadius: 6,
            border: `1.5px solid ${darkMode ? '#4f46e5' : '#c7d2fe'}`,
            background: darkMode ? '#2d3748' : '#f5f5ff',
            color: darkMode ? '#e2e8f0' : '#1e1b4b',
            fontFamily: 'monospace',
            fontSize: 13,
            letterSpacing: 1,
            outline: 'none',
            width: 0,
          }}
        />
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: darkMode ? '#9ca3af' : '#6b7280',
            lineHeight: 1,
            padding: '0 2px',
            flexShrink: 0,
          }}
          title="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// ─── Main Game Component ───────────────────────────────────────────────────────

const SketchHeadsGame = () => {
  const [gameState, setGameState] = useState('setup');
  const [players, setPlayers] = useState([]);
  const [currentDrawer, setCurrentDrawer] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [promptOptions, setPromptOptions] = useState([]);
  const [category, setCategory] = useState('general');
  const [guess, setGuess] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [timeLeft, setTimeLeft] = useState(90);
  const [scores, setScores] = useState({});
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(3);
  const [drawingTime, setDrawingTime] = useState(90);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [correctGuessers, setCorrectGuessers] = useState([]);
  const [promptSelectionTime, setPromptSelectionTime] = useState(30);
  const [usedPrompts, setUsedPrompts] = useState(new Set());
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [hintFraction, setHintFraction] = useState(0.5); // 0.25=Few, 0.5=Some, 0.75=Lots
  const [showSettings, setShowSettings] = useState(false);
  const [revealedLetters, setRevealedLetters] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [customPrompts, setCustomPrompts] = useState('');
  const [useCustomPrompts, setUseCustomPrompts] = useState(false);
  const [customPromptPacks, setCustomPromptPacks] = useState({});

  // Drawing state
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#2D3748');
  const [customColor, setCustomColor] = useState('#2D3748');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState('pen');
  const [drawings, setDrawings] = useState([]);
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [lastDrawPoint, setLastDrawPoint] = useState(null);
  const [saveWithTransparency, setSaveWithTransparency] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [smoothPoints, setSmoothPoints] = useState([]);

  // Custom color picker state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const paletteButtonRef = useRef(null);

  // Quit confirmation state
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const baseColors = [
    '#2D3748', '#E53E3E', '#DD6B20', '#D69E2E', '#38A169',
    '#319795', '#3182CE', '#5A67D8', '#805AD5', '#D53F8C',
    '#FFFFFF', '#A0AEC0', '#4A5568', '#1A202C'
  ];

  const categories = [
    { value: 'general', label: 'General', emoji: '🎲' },
    { value: 'animals', label: 'Animals', emoji: '🐾' },
    { value: 'food', label: 'Food & Drink', emoji: '🍕' },
    { value: 'places', label: 'Places', emoji: '🗺️' },
    { value: 'objects', label: 'Objects', emoji: '📦' },
    { value: 'popculture', label: 'Pop Culture', emoji: '🎬' }
  ];

  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [gameState]);

  useEffect(() => {
    if (isPaused) return;
    if (gameState === 'playing' && currentPrompt && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
        if (hintsEnabled && currentPrompt) {
          const letterCount = currentPrompt.prompt.split('').filter(c => /[a-zA-Z]/.test(c)).length;
          const maxHints = Math.max(1, Math.floor(letterCount * hintFraction));
          const fired = revealedLetters.length;
          if (fired < maxHints) {
            const nextHintAt = Math.round(drawingTime * (1 - (fired + 1) / (maxHints + 1)));
            if (timeLeft === nextHintAt) revealNextLetter();
          }
        }
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gameState === 'playing' && currentPrompt && timeLeft === 0) {
      endRound();
    } else if (gameState === 'playing' && !currentPrompt && promptSelectionTime > 0 && !generatingPrompts) {
      const timer = setTimeout(() => setPromptSelectionTime(promptSelectionTime - 1), 1000);
      return () => clearTimeout(timer);
    } else if (gameState === 'playing' && !currentPrompt && promptSelectionTime === 0) {
      skipDrawer();
    }
  }, [timeLeft, promptSelectionTime, gameState, currentPrompt, generatingPrompts, hintsEnabled, isPaused]);

  const revealNextLetter = () => {
    if (!currentPrompt) return;
    const prompt = currentPrompt.prompt;
    const letterIndices = [];
    for (let i = 0; i < prompt.length; i++) {
      if (prompt[i].match(/[a-zA-Z]/)) letterIndices.push(i);
    }
    const unrevealedIndices = letterIndices.filter(i => !revealedLetters.includes(i));
    if (unrevealedIndices.length > 1) {
      const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
      setRevealedLetters([...revealedLetters, randomIndex]);
    }
  };

  const getCategoryPromptGuidelines = (cat) => {
    const guidelines = {
      general: 'Mix of common nouns from any category - single words only unless proper nouns',
      animals: 'Animal species or breeds - single words - "elephant", "butterfly", "goldfish"',
      food: 'Food items, dishes, ingredients, drinks - single words - "pizza", "sushi", "hamburger"',
      places: 'Locations, landmarks, buildings - single words or proper nouns - "castle", "Eiffel Tower", "volcano"',
      objects: 'Everyday objects, tools, household items - single words - "umbrella", "laptop", "bicycle"',
      popculture: 'Pop culture items, characters, franchises - single words or proper nouns - "lightsaber", "Pokéball", "Batman"'
    };
    return guidelines[cat] || guidelines.general;
  };

  const parseCustomPromptFile = (text) => {
    const packs = {};
    const lines = text.split('\n');
    let currentCategory = null;
    let currentDifficulty = null;
    const validCategories = ['animals', 'food', 'places', 'objects', 'popculture', 'general'];
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      const categoryMatch = line.match(/^\[(.*)\]$/);
      if (categoryMatch) {
        let cat = categoryMatch[1].toLowerCase();
        if (!validCategories.includes(cat)) cat = 'general';
        currentCategory = cat;
        if (!packs[currentCategory]) packs[currentCategory] = { easy: [], medium: [], hard: [] };
        continue;
      }
      if (line.match(/^Easy:\s*$/i)) { currentDifficulty = 'easy'; continue; }
      if (line.match(/^Medium:\s*$/i)) { currentDifficulty = 'medium'; continue; }
      if (line.match(/^Hard:\s*$/i)) { currentDifficulty = 'hard'; continue; }
      if (currentCategory && currentDifficulty) {
        packs[currentCategory][currentDifficulty].push({ prompt: line, difficulty: currentDifficulty });
      }
    }
    return packs;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = parseCustomPromptFile(text);
      setCustomPromptPacks(parsed);
      setCustomPrompts(text);
    };
    reader.readAsText(file);
  };

  const getAvailableCustomPrompts = (cat, difficulty) => {
    if (!useCustomPrompts || !customPromptPacks) return [];
    if (cat === 'general') {
      const allPrompts = [];
      Object.values(customPromptPacks).forEach(pack => {
        if (pack[difficulty]) allPrompts.push(...pack[difficulty]);
      });
      return allPrompts;
    }
    if (customPromptPacks[cat] && customPromptPacks[cat][difficulty]) {
      return customPromptPacks[cat][difficulty];
    }
    return [];
  };

  const generatePrompts = async () => {
    setGeneratingPrompts(true);
    const promptsByDifficulty = { easy: [], medium: [], hard: [] };
    if (useCustomPrompts && Object.keys(customPromptPacks).length > 0) {
      try {
        ['easy', 'medium', 'hard'].forEach(diff => {
          const customPromptsForDiff = getAvailableCustomPrompts(category, diff)
            .filter(p => !usedPrompts.has(p.prompt.toLowerCase()));
          promptsByDifficulty[diff].push(...customPromptsForDiff);
        });
      } catch (error) { console.error('Error loading custom prompts:', error); }
    }
    const maxAttempts = 3;
    let attempts = 0;
    while (attempts < maxAttempts) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [{
              role: 'user',
              content: `Generate 3 random drawing prompts for a Pictionary-style game at different difficulty levels.

Category: ${category}
${getCategoryPromptGuidelines(category)}

Previously used prompts to AVOID: ${Array.from(usedPrompts).join(', ')}

CRITICAL RULES:
1. Prompts MUST be SINGLE WORDS unless they are proper nouns (like "Eiffel Tower")
2. NO ADJECTIVE + NOUN combinations
3. NO ACTION PHRASES
4. NO VERB PHRASES
5. NO DESCRIPTIVE SCENES
6. CORRECT examples: "elephant", "pizza", "Hogwarts", "Batman", "volcano"
7. Each prompt must be drawable as a THING, not an ACTION
8. Do NOT repeat any of these prompts: ${Array.from(usedPrompts).join(', ')}
9. Be creative and generate UNIQUE prompts not in the avoid list

Format as JSON only (no markdown):
[
  {"prompt": "example", "difficulty": "easy"},
  {"prompt": "example", "difficulty": "medium"},
  {"prompt": "example", "difficulty": "hard"}
]

Difficulty guidelines:
- Easy: Single common nouns (1 word) - "cat", "tree", "house"
- Medium: Less common single nouns OR proper nouns (1-2 words) - "telescope", "Pikachu"
- Hard: Complex/abstract single nouns OR multi-word proper nouns (1-3 words) - "kaleidoscope", "Statue of Liberty"

IMPORTANT: Generate EXACTLY one prompt of each difficulty (easy, medium, hard).

Respond with ONLY the JSON array, nothing else.`
            }]
          })
        });
        const data = await response.json();
        const text = data.content[0].text.trim().replace(/```json|```/g, '');
        const prompts = JSON.parse(text);
        const newPrompts = prompts.filter(p => {
          const promptLower = p.prompt.toLowerCase();
          if (usedPrompts.has(promptLower)) return false;
          const words = p.prompt.split(' ');
          if (words.length === 1) return true;
          return words[0][0] === words[0][0].toUpperCase();
        });
        ['easy', 'medium', 'hard'].forEach(diff => {
          const customForDiff = getAvailableCustomPrompts(category, diff)
            .filter(p => !usedPrompts.has(p.prompt.toLowerCase()));
          const aiForDiff = newPrompts.filter(p => p.difficulty === diff);
          promptsByDifficulty[diff].push(...customForDiff, ...aiForDiff);
        });
        if (promptsByDifficulty.easy.length > 0 && promptsByDifficulty.medium.length > 0 && promptsByDifficulty.hard.length > 0) {
          const selectedPrompts = new Set();
          const selected = [];
          ['easy', 'medium', 'hard'].forEach(diff => {
            const options = promptsByDifficulty[diff].filter(p => !selectedPrompts.has(p.prompt.toLowerCase()));
            if (options.length > 0) {
              const pick = options[Math.floor(Math.random() * options.length)];
              selected.push(pick);
              selectedPrompts.add(pick.prompt.toLowerCase());
            }
          });
          if (selected.length === 3) {
            setPromptOptions(selected);
            setGeneratingPrompts(false);
            return selected;
          }
        }
        attempts++;
      } catch (error) {
        console.error('Error generating prompts:', error);
        attempts++;
      }
    }

    const fallbacks = {
      general: [
        {prompt:'telescope',difficulty:'easy'},{prompt:'bridge',difficulty:'easy'},{prompt:'waterfall',difficulty:'easy'},
        {prompt:'anchor',difficulty:'easy'},{prompt:'compass',difficulty:'easy'},{prompt:'lantern',difficulty:'easy'},
        {prompt:'wheel',difficulty:'easy'},{prompt:'cloud',difficulty:'easy'},{prompt:'moon',difficulty:'easy'},
        {prompt:'star',difficulty:'easy'},{prompt:'mountain',difficulty:'easy'},{prompt:'river',difficulty:'easy'},
        {prompt:'rainbow',difficulty:'medium'},{prompt:'sunrise',difficulty:'medium'},{prompt:'thunderstorm',difficulty:'medium'},
        {prompt:'eclipse',difficulty:'medium'},{prompt:'tornado',difficulty:'medium'},{prompt:'meteor',difficulty:'medium'},
        {prompt:'glacier',difficulty:'medium'},{prompt:'canyon',difficulty:'medium'},{prompt:'comet',difficulty:'medium'},
        {prompt:'nebula',difficulty:'medium'},{prompt:'whirlpool',difficulty:'medium'},{prompt:'geyser',difficulty:'medium'},
        {prompt:'kaleidoscope',difficulty:'hard'},{prompt:'constellation',difficulty:'hard'},{prompt:'aurora',difficulty:'hard'},
        {prompt:'prism',difficulty:'hard'},{prompt:'labyrinth',difficulty:'hard'},{prompt:'obelisk',difficulty:'hard'},
        {prompt:'pendulum',difficulty:'hard'},{prompt:'monolith',difficulty:'hard'},{prompt:'ziggurat',difficulty:'hard'},
        {prompt:'catacomb',difficulty:'hard'},{prompt:'gargoyle',difficulty:'hard'},{prompt:'aqueduct',difficulty:'hard'}
      ],
      animals: [
        {prompt:'elephant',difficulty:'easy'},{prompt:'penguin',difficulty:'easy'},{prompt:'dolphin',difficulty:'easy'},
        {prompt:'turtle',difficulty:'easy'},{prompt:'rabbit',difficulty:'easy'},{prompt:'squirrel',difficulty:'easy'},
        {prompt:'duck',difficulty:'easy'},{prompt:'frog',difficulty:'easy'},{prompt:'bear',difficulty:'easy'},
        {prompt:'lion',difficulty:'easy'},{prompt:'giraffe',difficulty:'easy'},{prompt:'zebra',difficulty:'easy'},
        {prompt:'butterfly',difficulty:'medium'},{prompt:'chameleon',difficulty:'medium'},{prompt:'peacock',difficulty:'medium'},
        {prompt:'seahorse',difficulty:'medium'},{prompt:'porcupine',difficulty:'medium'},{prompt:'armadillo',difficulty:'medium'},
        {prompt:'flamingo',difficulty:'medium'},{prompt:'kangaroo',difficulty:'medium'},{prompt:'pelican',difficulty:'medium'},
        {prompt:'walrus',difficulty:'medium'},{prompt:'meerkat',difficulty:'medium'},{prompt:'hyena',difficulty:'medium'},
        {prompt:'octopus',difficulty:'hard'},{prompt:'platypus',difficulty:'hard'},{prompt:'axolotl',difficulty:'hard'},
        {prompt:'narwhal',difficulty:'hard'},{prompt:'pangolin',difficulty:'hard'},{prompt:'cassowary',difficulty:'hard'},
        {prompt:'mantis',difficulty:'hard'},{prompt:'nautilus',difficulty:'hard'},{prompt:'tapir',difficulty:'hard'},
        {prompt:'quokka',difficulty:'hard'},{prompt:'okapi',difficulty:'hard'},{prompt:'dugong',difficulty:'hard'}
      ],
      food: [
        {prompt:'pizza',difficulty:'easy'},{prompt:'burger',difficulty:'easy'},{prompt:'hotdog',difficulty:'easy'},
        {prompt:'apple',difficulty:'easy'},{prompt:'cookie',difficulty:'easy'},{prompt:'donut',difficulty:'easy'},
        {prompt:'banana',difficulty:'easy'},{prompt:'cake',difficulty:'easy'},{prompt:'bread',difficulty:'easy'},
        {prompt:'cheese',difficulty:'easy'},{prompt:'carrot',difficulty:'easy'},{prompt:'orange',difficulty:'easy'},
        {prompt:'sushi',difficulty:'medium'},{prompt:'tacos',difficulty:'medium'},{prompt:'ramen',difficulty:'medium'},
        {prompt:'pretzel',difficulty:'medium'},{prompt:'bagel',difficulty:'medium'},{prompt:'waffle',difficulty:'medium'},
        {prompt:'pancake',difficulty:'medium'},{prompt:'burrito',difficulty:'medium'},{prompt:'lasagna',difficulty:'medium'},
        {prompt:'tempura',difficulty:'medium'},{prompt:'falafel',difficulty:'medium'},{prompt:'dumpling',difficulty:'medium'},
        {prompt:'croissant',difficulty:'hard'},{prompt:'tiramisu',difficulty:'hard'},{prompt:'macarons',difficulty:'hard'},
        {prompt:'baklava',difficulty:'hard'},{prompt:'pavlova',difficulty:'hard'},{prompt:'beignet',difficulty:'hard'},
        {prompt:'cannoli',difficulty:'hard'},{prompt:'profiterole',difficulty:'hard'},{prompt:'bouillabaisse',difficulty:'hard'},
        {prompt:'ratatouille',difficulty:'hard'},{prompt:'escargot',difficulty:'hard'}
      ],
      places: [
        {prompt:'castle',difficulty:'easy'},{prompt:'lighthouse',difficulty:'easy'},{prompt:'volcano',difficulty:'easy'},
        {prompt:'cave',difficulty:'easy'},{prompt:'tower',difficulty:'easy'},{prompt:'temple',difficulty:'easy'},
        {prompt:'bridge',difficulty:'easy'},{prompt:'church',difficulty:'easy'},{prompt:'mosque',difficulty:'easy'},
        {prompt:'palace',difficulty:'easy'},{prompt:'fort',difficulty:'easy'},{prompt:'ruins',difficulty:'easy'},
        {prompt:'pyramid',difficulty:'medium'},{prompt:'windmill',difficulty:'medium'},{prompt:'Big Ben',difficulty:'medium'},
        {prompt:'igloo',difficulty:'medium'},{prompt:'pagoda',difficulty:'medium'},{prompt:'canyon',difficulty:'medium'},
        {prompt:'aqueduct',difficulty:'medium'},{prompt:'basilica',difficulty:'medium'},{prompt:'monastery',difficulty:'medium'},
        {prompt:'cathedral',difficulty:'medium'},{prompt:'observatory',difficulty:'medium'},{prompt:'amphitheater',difficulty:'medium'},
        {prompt:'Colosseum',difficulty:'hard'},{prompt:'Taj Mahal',difficulty:'hard'},{prompt:'Stonehenge',difficulty:'hard'},
        {prompt:'Parthenon',difficulty:'hard'},{prompt:'Angkor Wat',difficulty:'hard'},{prompt:'Machu Picchu',difficulty:'hard'},
        {prompt:'Sagrada Familia',difficulty:'hard'},{prompt:'Hagia Sophia',difficulty:'hard'},{prompt:'Petra',difficulty:'hard'},
        {prompt:'Chichen Itza',difficulty:'hard'},{prompt:'Alhambra',difficulty:'hard'}
      ],
      objects: [
        {prompt:'umbrella',difficulty:'easy'},{prompt:'bicycle',difficulty:'easy'},{prompt:'crown',difficulty:'easy'},
        {prompt:'shield',difficulty:'easy'},{prompt:'basket',difficulty:'easy'},{prompt:'ladder',difficulty:'easy'},
        {prompt:'hammer',difficulty:'easy'},{prompt:'scissors',difficulty:'easy'},{prompt:'pencil',difficulty:'easy'},
        {prompt:'key',difficulty:'easy'},{prompt:'lock',difficulty:'easy'},{prompt:'bell',difficulty:'easy'},
        {prompt:'telescope',difficulty:'medium'},{prompt:'compass',difficulty:'medium'},{prompt:'binoculars',difficulty:'medium'},
        {prompt:'harmonica',difficulty:'medium'},{prompt:'tambourine',difficulty:'medium'},{prompt:'pendulum',difficulty:'medium'},
        {prompt:'abacus',difficulty:'medium'},{prompt:'sundial',difficulty:'medium'},{prompt:'barometer',difficulty:'medium'},
        {prompt:'thermometer',difficulty:'medium'},{prompt:'protractor',difficulty:'medium'},{prompt:'kaleidoscope',difficulty:'medium'},
        {prompt:'microscope',difficulty:'hard'},{prompt:'hourglass',difficulty:'hard'},{prompt:'metronome',difficulty:'hard'},
        {prompt:'sextant',difficulty:'hard'},{prompt:'astrolabe',difficulty:'hard'},{prompt:'periscope',difficulty:'hard'},
        {prompt:'chronometer',difficulty:'hard'},{prompt:'theodolite',difficulty:'hard'},{prompt:'spectrometer',difficulty:'hard'},
        {prompt:'seismograph',difficulty:'hard'},{prompt:'spirograph',difficulty:'hard'},{prompt:'gyroscope',difficulty:'hard'}
      ],
      popculture: [
        {prompt:'lightsaber',difficulty:'easy'},{prompt:'Batmobile',difficulty:'easy'},{prompt:'Triforce',difficulty:'easy'},
        {prompt:'wand',difficulty:'easy'},{prompt:'cape',difficulty:'easy'},{prompt:'mask',difficulty:'easy'},
        {prompt:'sword',difficulty:'easy'},{prompt:'shield',difficulty:'easy'},{prompt:'crown',difficulty:'easy'},
        {prompt:'ring',difficulty:'easy'},{prompt:'crystal',difficulty:'easy'},{prompt:'orb',difficulty:'easy'},
        {prompt:'Pokéball',difficulty:'medium'},{prompt:'DeLorean',difficulty:'medium'},{prompt:'Infinity Gauntlet',difficulty:'medium'},
        {prompt:'Batcave',difficulty:'medium'},{prompt:'Tardis',difficulty:'medium'},{prompt:'Hoverboard',difficulty:'medium'},
        {prompt:'Proton Pack',difficulty:'medium'},{prompt:'Portal Gun',difficulty:'medium'},{prompt:'Sonic Screwdriver',difficulty:'medium'},
        {prompt:'Master Sword',difficulty:'medium'},{prompt:'Batarang',difficulty:'medium'},{prompt:'Flux Capacitor',difficulty:'medium'},
        {prompt:'Mjolnir',difficulty:'hard'},{prompt:'Excalibur',difficulty:'hard'},{prompt:'One Ring',difficulty:'hard'},
        {prompt:'Millennium Falcon',difficulty:'hard'},{prompt:'Enterprise',difficulty:'hard'},{prompt:'Gryffindor',difficulty:'hard'},
        {prompt:'Necronomicon',difficulty:'hard'},{prompt:'Tesseract',difficulty:'hard'},{prompt:'Philosophers Stone',difficulty:'hard'},
        {prompt:'Palantir',difficulty:'hard'},{prompt:'Invisibility Cloak',difficulty:'hard'},{prompt:'Elder Wand',difficulty:'hard'}
      ]
    };

    const categoryFallbacks = fallbacks[category] || fallbacks.general;
    const easyFallbacks = categoryFallbacks.filter(p => p.difficulty === 'easy' && !usedPrompts.has(p.prompt.toLowerCase()));
    const mediumFallbacks = categoryFallbacks.filter(p => p.difficulty === 'medium' && !usedPrompts.has(p.prompt.toLowerCase()));
    const hardFallbacks = categoryFallbacks.filter(p => p.difficulty === 'hard' && !usedPrompts.has(p.prompt.toLowerCase()));
    if (useCustomPrompts) {
      easyFallbacks.push(...getAvailableCustomPrompts(category, 'easy').filter(p => !usedPrompts.has(p.prompt.toLowerCase())));
      mediumFallbacks.push(...getAvailableCustomPrompts(category, 'medium').filter(p => !usedPrompts.has(p.prompt.toLowerCase())));
      hardFallbacks.push(...getAvailableCustomPrompts(category, 'hard').filter(p => !usedPrompts.has(p.prompt.toLowerCase())));
    }
    if (easyFallbacks.length > 0 && mediumFallbacks.length > 0 && hardFallbacks.length > 0) {
      const selectedPrompts = new Set();
      const selected = [];
      [[easyFallbacks,'easy'],[mediumFallbacks,'medium'],[hardFallbacks,'hard']].forEach(([pool]) => {
        const opts = pool.filter(p => !selectedPrompts.has(p.prompt.toLowerCase()));
        if (opts.length > 0) {
          const pick = opts[Math.floor(Math.random() * opts.length)];
          selected.push(pick);
          selectedPrompts.add(pick.prompt.toLowerCase());
        }
      });
      if (selected.length === 3) {
        setPromptOptions(selected);
        setGeneratingPrompts(false);
        return selected;
      }
    }
    const shuffled = categoryFallbacks.sort(() => Math.random() - 0.5);
    setPromptOptions(shuffled.slice(0, 3));
    setGeneratingPrompts(false);
    return shuffled.slice(0, 3);
  };

  const startGame = async () => {
    if (players.length < 2) { alert('Need at least 2 players!'); return; }
    const initialScores = {};
    players.forEach(p => initialScores[p] = 0);
    setScores(initialScores);
    setRound(1);
    setCurrentDrawer(0);
    setCurrentPrompt(null);
    setPromptOptions([]);
    setUsedPrompts(new Set());
    setGuesses([]);
    setCorrectGuessers([]);
    setPromptSelectionTime(30);
    setRevealedLetters([]);
    setShowClearDialog(false);
    setShowColorPicker(false);
    clearCanvasInternal();
    setGameState('playing');
    const prompts = await generatePrompts();
    if (prompts) setPromptOptions(prompts);
  };

  const selectPrompt = (promptObj) => {
    setCurrentPrompt(promptObj);
    setTimeLeft(drawingTime);
    setBrushSize(3);
    setRevealedLetters([]);
    setShowClearDialog(false);
    setShowColorPicker(false);
    setUsedPrompts(prev => new Set([...prev, promptObj.prompt.toLowerCase()]));
  };

  const skipDrawer = () => {
    setGameState('roundEnd');
    setTimeout(() => {
      if (round < maxRounds * players.length) {
        setRound(round + 1);
        setCurrentDrawer((currentDrawer + 1) % players.length);
        setGameState('playing');
        setCurrentPrompt(null);
        setPromptSelectionTime(30);
        setShowClearDialog(false);
        setShowColorPicker(false);
        generatePrompts();
        setGuesses([]);
        setCorrectGuessers([]);
        clearCanvasInternal();
      } else {
        setGameState('gameEnd');
      }
    }, 2000);
  };

  const getDrawing = () => {
    const canvas = canvasRef.current;

    if (saveWithTransparency) {
      // Canvas has transparent background — strokes have real alpha, white strokes
      // are opaque (alpha=255), background is transparent (alpha=0). Just export as-is.
      return canvas.toDataURL('image/png');
    }

    // Composite onto white for the opaque version
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);
    return tempCanvas.toDataURL('image/png');
  };

  const endRound = () => {
    if (currentPrompt) {
      const drawing = getDrawing();
      setDrawings([...drawings, {
        prompt: currentPrompt.prompt,
        difficulty: currentPrompt.difficulty,
        drawer: players[currentDrawer],
        image: drawing,
        round
      }]);
      if (correctGuessers.length > 0) {
        const difficultyPoints = { easy: 100, medium: 200, hard: 300 };
        const drawerScore = difficultyPoints[currentPrompt.difficulty] || 150;
        setScores(prev => ({
          ...prev,
          [players[currentDrawer]]: (prev[players[currentDrawer]] || 0) + drawerScore
        }));
      }
    }
    setGameState('roundEnd');
    setTimeout(() => {
      if (round < maxRounds * players.length) {
        setRound(round + 1);
        setCurrentDrawer((currentDrawer + 1) % players.length);
        setGameState('playing');
        setCurrentPrompt(null);
        setPromptSelectionTime(30);
        setShowColorPicker(false);
        generatePrompts();
        setGuesses([]);
        setCorrectGuessers([]);
        clearCanvasInternal();
      } else {
        setGameState('gameEnd');
      }
    }, 3000);
  };

  const submitGuess = () => {
    if (!guess.trim() || !currentPrompt) return;
    const guesserName = players.find((_, i) => i !== currentDrawer) || 'Player';
    if (correctGuessers.includes(guesserName)) { setGuess(''); return; }

    const promptLower = currentPrompt.prompt.toLowerCase().trim();
    // Strip accidental leading/trailing symbols (e.g. "cat!" → "cat")
    const cleaned = guess.toLowerCase().trim().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');

    const isCorrect = cleaned === promptLower;
    const isOneOff  = !isCorrect && levenshtein(cleaned, promptLower) === 1;

    const newGuess = { player: guesserName, text: guess, time: drawingTime - timeLeft, correct: isCorrect, oneOff: isOneOff };
    setGuesses([...guesses, newGuess]);

    if (isCorrect) {
      const newCorrectGuessers = [...correctGuessers, guesserName];
      setCorrectGuessers(newCorrectGuessers);
      const timeBonus = Math.max(100, 500 - (drawingTime - timeLeft) * 5);
      const positionBonus = newCorrectGuessers.length === 1 ? 200 : 0;
      setScores(prev => ({ ...prev, [guesserName]: (prev[guesserName] || 0) + timeBonus + positionBonus }));
      const nonDrawerPlayers = players.filter((_, i) => i !== currentDrawer);
      if (newCorrectGuessers.length === nonDrawerPlayers.length) setTimeout(() => endRound(), 1000);
    }
    setGuess('');
  };

  const bucketFill = (startX, startY, fillColor) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    startX = Math.round(startX);
    startY = Math.round(startY);
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const pIdx = (startY * width + startX) * 4;
    const targetR = data[pIdx], targetG = data[pIdx + 1], targetB = data[pIdx + 2], targetA = data[pIdx + 3];

    const fillRgb = hexToRgb(fillColor);
    if (targetR === fillRgb.r && targetG === fillRgb.g && targetB === fillRgb.b && targetA === 255) return;

    const tolerance = 36;
    const matchesTarget = (i) => {
      const dr = data[i] - targetR, dg = data[i + 1] - targetG;
      const db = data[i + 2] - targetB, da = data[i + 3] - targetA;
      return Math.sqrt(dr * dr + dg * dg + db * db + da * da) <= tolerance;
    };

    // DFS flood fill → mask (1 = direct BFS hit, 2 = fringe expansion)
    const mask = new Uint8Array(width * height);
    const visited = new Uint8Array(width * height);
    const startPos = startY * width + startX;
    const stack = [startPos];
    visited[startPos] = 1;

    while (stack.length > 0) {
      const pos = stack.pop();
      if (!matchesTarget(pos * 4)) continue;
      mask[pos] = 1;
      const x = pos % width, y = (pos / width) | 0;
      if (x > 0          && !visited[pos - 1])     { visited[pos - 1] = 1;     stack.push(pos - 1); }
      if (x < width - 1  && !visited[pos + 1])     { visited[pos + 1] = 1;     stack.push(pos + 1); }
      if (y > 0          && !visited[pos - width])  { visited[pos - width] = 1; stack.push(pos - width); }
      if (y < height - 1 && !visited[pos + width])  { visited[pos + width] = 1; stack.push(pos + width); }
    }

    // Expand 1px into semi-transparent neighbours — these are anti-aliased stroke edges.
    // With a transparent canvas background, real edge pixels carry proper alpha values
    // (0 < alpha < 255) rather than being baked into opaque grey pixels.
    // Mark these as 2 so we can treat them differently below.
    for (let i = 0; i < width * height; i++) {
      if (mask[i] !== 1) continue;
      const x = i % width, y = (i / width) | 0;
      const ns = [];
      if (x > 0)          ns.push(i - 1);
      if (x < width - 1)  ns.push(i + 1);
      if (y > 0)          ns.push(i - width);
      if (y < height - 1) ns.push(i + width);
      for (const n of ns) {
        if (!mask[n]) {
          const ni = n * 4;
          const a = data[ni + 3];
          if (a > 0 && a < 255) mask[n] = 2;
        }
      }
    }

    // BFS pixels: set directly to fill colour — works for first fill AND refill.
    for (let i = 0; i < width * height; i++) {
      if (mask[i] !== 1) continue;
      const px = i * 4;
      data[px]     = fillRgb.r;
      data[px + 1] = fillRgb.g;
      data[px + 2] = fillRgb.b;
      data[px + 3] = 255;
    }

    // Fringe pixels: these are semi-transparent anti-aliased stroke edge pixels.
    // The canvas has transparent background so they carry real alpha.
    // We want fill to appear "behind" the stroke edge:
    //   result = stroke × (alpha/255) + fill × (1 − alpha/255)
    // Then composite that opaque result onto the canvas.
    for (let i = 0; i < width * height; i++) {
      if (mask[i] !== 2) continue;
      const px = i * 4;
      const a  = data[px + 3] / 255; // stroke coverage (0=transparent, 1=opaque)
      data[px]     = Math.round(data[px]     * a + fillRgb.r * (1 - a));
      data[px + 1] = Math.round(data[px + 1] * a + fillRgb.g * (1 - a));
      data[px + 2] = Math.round(data[px + 2] * a + fillRgb.b * (1 - a));
      data[px + 3] = 255; // flatten to opaque
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const startDrawing = (e) => {
    if (gameState !== 'playing' || !currentPrompt || isPaused) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    if (isPickingColor) { pickColorFromCanvas(x, y); return; }

    if (tool === 'fill') {
      bucketFill(x, y, color);
      return;
    }
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = brushSize * 2;
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.fillStyle = color;
    }
    ctx.beginPath();
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
    setLastDrawPoint({ x, y });
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || gameState !== 'playing' || isPickingColor || isPaused) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = brushSize * 2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
    }
    const newPoints = [...smoothPoints, { x, y }];
    setSmoothPoints(newPoints);
    if (newPoints.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(newPoints[0].x, newPoints[0].y);
      for (let i = 1; i < newPoints.length - 1; i++) {
        const xc = (newPoints[i].x + newPoints[i + 1].x) / 2;
        const yc = (newPoints[i].y + newPoints[i + 1].y) / 2;
        ctx.quadraticCurveTo(newPoints[i].x, newPoints[i].y, xc, yc);
      }
      ctx.stroke();
    }
    setLastDrawPoint({ x, y });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastDrawPoint(null);
    setSmoothPoints([]);
  };

  const handleMouseEnter = (e) => {
    if (!currentPrompt || isPaused || isPickingColor || !isDrawing) return;
    if (e.buttons === 1 && gameState === 'playing') {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = brushSize * 2;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
      }
      ctx.beginPath();
      ctx.moveTo(x, y);
      setSmoothPoints([{ x, y }]);
      setLastDrawPoint({ x, y });
      setIsDrawing(true);
    } else {
      setIsDrawing(false);
      setLastDrawPoint(null);
      setSmoothPoints([]);
    }
  };

  const pickColorFromCanvas = (x, y) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pixelX = Math.round(x);
    const pixelY = Math.round(y);
    const imageData = ctx.getImageData(pixelX, pixelY, 1, 1);
    const [r, g, b, a] = imageData.data;
    if (a > 0) {
      const hexColor = '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
      setColor(hexColor);
      setCustomColor(hexColor);
    }
    setIsPickingColor(false);
  };

  const clearCanvas = () => {
    if (!currentPrompt || showClearDialog) return;
    setShowClearDialog(true);
  };

  const clearCanvasInternal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const confirmClearCanvas = () => {
    clearCanvasInternal();
    setShowClearDialog(false);
  };

  const downloadDrawing = (drawing) => {
    const link = document.createElement('a');
    const filename = `${drawing.prompt.replace(/\s+/g, '_')}_by_${drawing.drawer.replace(/\s+/g, '_')}.png`;
    link.download = filename;
    link.href = drawing.image;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Setup Screen ────────────────────────────────────────────────────────────

  if (gameState === 'setup') {
    return (
      <>
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100'} p-8`}>
        <div className={`max-w-2xl mx-auto ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8`}>
          <div className="mb-6 relative">
            <div className="absolute top-0 right-0 flex gap-2">
              <button onClick={() => setShowSettings(true)}
                className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'} transition-colors`}
                title="Settings">
                <Settings size={20} />
              </button>
              <button onClick={() => setDarkMode(!darkMode)} className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'} transition-colors`} title="Toggle dark mode">
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
            <div className="flex justify-center py-2">
              <svg style={{maxWidth:"320px",width:"100%"}} id="Layer_1_copy_2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150"><defs><linearGradient id="linear-gradient" x1="99.88" y1="141.17" x2="99.88" y2="47.39" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#5bc6cb"/><stop offset="1" stopColor="#e0e99f"/></linearGradient><linearGradient id="linear-gradient-2" x1="44.8" y1="137.78" x2="44.8" y2="37.53" href="#linear-gradient"/><linearGradient id="linear-gradient-3" x1="264.71" y1="119.54" x2="264.71" y2="44.79" href="#linear-gradient"/><linearGradient id="linear-gradient-4" x1="179.13" y1="103.54" x2="179.13" y2="46.98" href="#linear-gradient"/><linearGradient id="linear-gradient-5" x1="64.48" y1="108.59" x2="64.48" y2="49.67" href="#linear-gradient"/><linearGradient id="linear-gradient-6" x1="143.12" y1="112.75" x2="143.12" y2="42.2" href="#linear-gradient"/><linearGradient id="linear-gradient-7" x1="218.96" y1="104.02" x2="218.96" y2="56.48" href="#linear-gradient"/><linearGradient id="linear-gradient-8" x1="150.11" y1="146.63" x2="150.11" y2="43.12" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#4259a8"/><stop offset=".7" stopColor="#8b56a3"/><stop offset="1" stopColor="#cc6fac"/></linearGradient><linearGradient id="linear-gradient-9" x1="150.22" y1="141.21" x2="150.22" y2="37.2" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#cc6fac"/><stop offset=".3" stopColor="#8b56a3"/><stop offset="1" stopColor="#4259a8"/></linearGradient><linearGradient id="linear-gradient-10" x1="105.07" y1="-13.68" x2="148.26" y2="37.79" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#5ac2ef"/><stop offset=".2" stopColor="#665ea9"/><stop offset=".4" stopColor="#f0659e"/><stop offset=".6" stopColor="#f6905c"/><stop offset=".8" stopColor="#e8da1c"/><stop offset="1" stopColor="#72c6ae"/></linearGradient></defs><path fill="url(#linear-gradient)" d="M103.35,141.17h-3.6c-2.97-.57-5.99-1.07-8.78-2.52-3.75-1.95-6.74-4.94-8.31-8.81-1.75-4.3-1.12-8.86,1.62-12.53,2.1-2.81,4.93-4.61,8.19-5.89,2.76-1.08,5.48-1.87,8.47-2.14l3.93-.35-5.55-3.06c-1.88-1.04-3.57-2.43-4.94-4.07-3.32-4-2.63-8.94.35-13.12-7.05-2.05-13.21-5.06-17.85-10.86-5.45-6.82-5.31-16.61.57-23.09,8.84-9.74,24.08-9.24,34.25-1.76,4.71-2.58,8.38-3.15,13.66-3.38.65.38,1.37,1.48,1.38,2.26l.09,7.06c-1.43-.02-7.94.7-8.07,1.67-.02.12.08.46.14.58,3.73,6.79,2.6,14.92-2.93,20.34-.33.32-.77.98-.9,1.2l2.36.59-.02,7.54c-3.87.13-7.37.03-11.34-.28-1.43.97-2.72,2.43-3.57,4.08-1.21,2.33,4.65,4.95,6.5,5.88,3.5,1.76,6.8,3.58,9.94,6.05l3.1-1.93,4.77,6.03-2.83,2.4c2.7,5.86,1.76,12.02-1.73,17.06-4.98,7.2-10.6,9.71-18.92,11.03ZM101.68,81.85l6.81-5.93c2.06-2.16,3.51-4.73,3.28-7.8-.26-3.51-2.08-6.5-4.83-8.65-6.44-3.71-15.81-3.85-20.91,2.14-3.06,3.59-2.75,8.72.27,12.27,3.71,4.47,9.67,6.88,15.38,7.96ZM92.85,125.69c3.63,6.91,15.45,7.16,21.44,1.51,2.85-2.68,2.62-7.35.88-10.44-6.87,1.42-12,.73-18.55,1.79-1.23.3-2.17.77-2.99,1.66-1.38,1.51-1.85,3.46-.79,5.48Z"/><path fill="url(#linear-gradient-2)" d="M10.79,51.85v-.24c.28-.36.54-.92.73-1.47,1.14-3.29,2.11-6.43,3.63-9.55.88-1.8,2.81-3.53,4.88-2.96,2.3.63,4.38,1.62,6.59,2.48,1.05.41,1.85,1.38,2.34,2.41,11.43,23.57,12.66,52.66,11.72,78.53,5.1-2.2,10.02-3.77,15.24-5.23,7.54-2.11,14.99-3.71,22.9-3.91l-.13,7.64-3.05,1.31c-12.64.9-24.7,3.56-35.67,10.15l-7.6,4.57c-1.6.96-3.47,1.42-5.36,2.18l1.06-26.79c.6-15.12-1.79-40.19-6.77-54.72-1.1-.37-2.3-.46-3.25-.92l-7.24-3.5Z"/><path fill="url(#linear-gradient-3)" d="M283.27,118.4l-11.92-8.53c-4.32-3.09-8.79-5.59-13.77-7.46l1.96-7.29,5.52.29-3.26-6.47c-3.39,3.2-6.34,6.46-9.16,10.05l-.25,3.18c-4.06-.24-8.01-.39-11.99-1.07l3.47-54.36,4.19-1.95,5.54,7.65c4.6,6.35,8.78,12.73,12.9,19.51,2.69-1.29,4.23-1.21,7.15-1.6l3.76,6.92-5.83,3.65c4.79,8.82,8.98,17.68,12.73,26.98l4.68,11.64-5.74-1.14ZM256.48,79.19l-2.3-3.76-.38,6,2.68-2.24Z"/><path fill="url(#linear-gradient-4)" d="M172.74,100.77l-7.38,1.04c-.37.05-1.14-.31-1.2-.8l-4.62-35.97c-.34-2.64.06-5.21,1.39-7.43s4.5-2.71,6.66-1.16c1.47,1.06,2.63,2.41,3.68,3.97l16.88,24.97c-.6-12.52-1.28-24.4-1.27-36.53l1.6-1.88,8.03.09c.11,16.46.92,32.53,2.27,48.79.12,1.5-.06,2.89-.41,4.2-.76,2.9-3.7,4.17-6.41,3.11-1.04-.41-2.21-.75-3.06-1.46-1.64-1.35-2.76-2.94-3.96-4.7l-15.48-22.89,3.28,26.64Z"/><path fill="url(#linear-gradient-5)" d="M57.01,107.51l-4.24.87-7.89.21c-.17-6.19.03-12.04.51-18.21l-1.85-.38.9-7.85,1.91.03c1.28-8.5,3.11-16.75,5.76-24.94l2.46-7.57,4.11,1.74,4.39,5.98c10.01,13.64,17.56,28.77,22.35,45.12l-6.91,2.06c-1.18.35-2.48.56-3.63.78l-3.29-9.8c-4.73-1.27-9.17-2.33-14.14-3.33-.45,5.22-.51,9.99-.44,15.3ZM67.27,85.35c-2.21-4.81-4.23-8.69-6.79-12.87-.93,3.92-1.55,7.4-2.09,11.26l8.88,1.62Z"/><path fill="url(#linear-gradient-6)" d="M145.49,84.34c-.18-.22-1.02-.24-1.29-.15l-7.64,2.36-2.78,14.37c-.13.65-.7,1.24-1.33,1.11l-7.35-1.48,2.08-10.83-1.8-.22-2.29-7.51,5.86-1.82,7.57-37.97,6.08,13.04,7.5,18.47,5.56-1.61,2.22,7.31c.06.2-.31.7-.5.76l-4.32,1.41,10.13,28.61-7.56,2.56-10.12-28.4ZM142.36,76.12c-.84-2.38-1.51-4.24-2.59-6.45l-1.49,7.63,4.08-1.18Z"/><path fill="url(#linear-gradient-7)" d="M204.06,103.49l-1.37-7.37,2.82-.74-1.29-10.18-2.51.06-.76-7.49,2.22-.66-.99-7.66-2.38.09-.91-7.36,2.21-1.49,34.18-4.2,1.08,7.84c-1.15.35-2.35.94-3.58,1.1l-20.21,2.66,1,8.05,9.44-.93.81,7.94-9.21.96,1.3,9.98c7.92-.68,15.31-.9,23.12-.42l-.23,8c-10.3-.36-20.3.39-30.38,2.17-1.46.26-2.77.35-4.36-.34Z"/><path fill="url(#linear-gradient-8)" stroke="url(#linear-gradient-9)" strokeMiterlimit="10" strokeWidth=".5" d="M45,108.48l8-.24c-.17-5.65,0-11.29.48-16.89,6.14,1.05,12.24,2.41,18.23,4.09,1.21,3.23,2.3,6.5,3.28,9.82l7.67-2.26c-5.01-17.01-12.87-32.88-23.36-47.17l-4.64-6.31-2.4,7.46c-2.66,8.27-4.6,16.71-5.81,25.24-.63-.08-1.27-.17-1.9-.24l-.91,7.95c.63.07,1.27.16,1.9.24-.54,6.07-.73,12.18-.54,18.31ZM57.57,67.4c3.9,6.01,7.33,12.28,10.29,18.78-4.46-1.09-8.96-2.02-13.48-2.79.76-5.38,1.82-10.72,3.19-15.99ZM120.93,105.23c-1.06.84-2.15,1.52-3.26,2.07-3.18-2.71-6.92-4.62-10.08-6.23-2.2-1.12-4.27-2.18-5.62-3.21-.62-.47-1.66-1.38-1.68-2.16-.03-1.38,1.76-3.43,3.91-5.45,4.87.54,9.16.54,11.9.54v-8c-1.04,0-2.12,0-3.23-.04.9-.83,1.72-1.66,2.44-2.5,4.44-4.87,5.78-11.66,3.51-17.77-.4-1.2-.92-2.34-1.56-3.44,2.14-.98,4.97-1.48,8.71-1.57l-.19-8c-4.15.1-9.48.64-13.95,3.43-2.73-2.11-6.06-3.74-9.79-4.71-8.62-2.23-17.18-.41-22.91,4.88-7.04,6.03-8.13,16.63-2.48,24.17,4.58,6.11,11.42,9.46,18.29,11.3-1.66,2.25-2.7,4.66-2.65,7.31.06,3.15,1.68,5.96,4.82,8.36,1.93,1.47,4.31,2.69,6.84,3.98.93.48,1.87.95,2.79,1.45-.86.05-1.72.08-2.59.11-5.97.24-12.15.48-17.27,4.83-4.23,3.59-5.94,8.48-4.68,13.42,1.51,5.91,6.98,10.81,13.64,12.23,1.89.5,3.87.74,5.86.74,6.19,0,12.52-2.33,16.98-6.49,4.8-4.48,6.77-10.36,5.54-16.61-.32-1.54-.81-2.94-1.45-4.22,1.06-.61,2.11-1.32,3.14-2.14l-4.97-6.27ZM83.06,72.45c-3.14-4.19-2.55-10.04,1.33-13.33l.14-.12c2.6-2.42,6.35-3.71,10.43-3.71,1.67,0,3.39.22,5.1.66,5.56,1.44,9.85,4.93,11.21,9.1l.06.17c1.25,3.31.51,7.02-1.94,9.68l-.12.14c-1.27,1.52-3.42,3.3-5.68,5.18-.63.53-1.27,1.06-1.9,1.59-7.37-1.21-14.48-3.82-18.62-9.35ZM113.22,128.62c-3.92,3.66-10.26,5.24-15.41,3.85l-.23-.06c-3.66-.75-6.86-3.44-7.62-6.39-.5-1.97.18-3.71,2.1-5.33,3.02-2.56,7.38-2.73,12.42-2.94,3.29-.13,6.99-.28,10.79-1.18.51.87.89,1.82,1.11,2.86.86,4.36-1.24,7.4-3.15,9.18ZM158.08,79.59l-2.33-7.65-5.55,1.69c-3.08-8.09-6.08-15.57-8.48-20.73l-5.09-10.96-2.45,11.83c-2.16,10.41-3.67,18.52-5.11,26.29l-5.86,1.79,2.33,7.65,1.89-.57c-.7,3.74-1.43,7.5-2.24,11.48l7.84,1.59c1.12-5.5,2.07-10.55,3.03-15.71l9.29-2.83c4.07,10.97,7.98,22.13,10.38,29.18l7.57-2.58c-2.53-7.42-6.33-18.26-10.28-28.93l5.07-1.54ZM137.68,77.44c.56-2.99,1.14-6.06,1.77-9.35.99,2.5,2.02,5.15,3.06,7.87l-4.83,1.47ZM198.9,95.87c.28,6.01-2.4,7.42-4.7,7.55l-.83.05-.78-.29c-2.54-.95-4.18-3.36-5.63-5.49-.29-.43-.57-.84-.83-1.18l-.12-.17c-3.67-5.46-7.35-10.94-11.03-16.42l-5.91-8.79,3.82,29.58-7.93,1.02-4.43-34.41c-.01-.19-.06-.54-.12-.97-.52-3.93-1.1-8.38,2.11-10.3,1.66-.99,3.69-.83,5.44.43l.21.16c1.71,1.41,3.17,3.56,4.47,5.46l.57.83,8.42,12.53c2.9,4.31,5.79,8.62,8.68,12.92-.97-13.18-1.71-31.35-1.63-41.53l8,.06c-.09,11.97.98,35.21,2.19,47.82l.02.21v.21c0,.2,0,.45.02.71ZM239.18,93.54l-.25,8c-11.04-.35-20.72.4-32.36,2.5l-1.42-7.87c1.02-.18,2-.34,2.99-.51l-1.4-10.91-2.61.26-.79-7.96,2.39-.24-1.09-8.48c-.87.11-1.71.21-2.49.31l-.97-7.94c.8-.1,26.75-3.36,34.24-4.36l1.06,7.93c-6.35.85-15.68,2.05-23.9,3.08.32,2.52.7,5.49,1.11,8.68l9.45-.94.79,7.96-9.23.92c.47,3.65.93,7.28,1.36,10.57,7.77-.93,15.1-1.24,23.11-.99ZM283.96,106.6c-3.58-8.82-7.68-17.42-12.23-25.78,1.95-1.35,3.91-2.58,5.85-3.65l-3.85-7.01c-1.98,1.08-3.97,2.32-5.95,3.67-4.04-6.9-8.39-13.62-13.06-20.11l-6.53-9.08-3.63,56.91,7.98.51.2-3.17c3.65-4.73,7.98-9.23,12.57-13.13,2.17,4.05,4.24,8.15,6.18,12.31-2.33-1.19-4.75-2.23-6.95-2.82l-2.08,7.72c5.04,1.36,12.85,6.51,15.43,8.38l11.31,8.18-5.25-12.92ZM253.59,85.79l1.14-17.91c2.3,3.53,4.51,7.13,6.62,10.78-2.68,2.21-5.3,4.6-7.77,7.13ZM75.76,112.81l-.14,8h0c-.35,0-21.85.49-42.02,12.88l-6.52,4.01.43-7.64c1.26-22.37,1.67-53.84-7.85-78.84-.73,2.13-1.15,3.3-1.53,4.05l-3.57-1.8-3.58-1.79c.2-.41.77-2.09,1.2-3.31,2.6-7.55,3.67-10.67,7.13-10.9,1.72-.11,3.3.81,4.1,2.41,12.59,25.15,13.47,58.31,12.43,83.41,20.33-10.27,39.66-10.52,39.9-10.47Z"/><path fill="url(#linear-gradient-10)" d="M136.3,39.47c-.67-1.12-1.25-2.27-1.83-3.41-.28-.58-.56-1.15-.83-1.73-.27-.58-.53-1.16-.75-1.75-.23-.63.04-1.32.61-1.63l.24-.13c1.71-.94,3.53-1.64,5.34-2.37,1.82-.71,3.66-1.34,5.52-1.91,1.86-.57,3.73-1.1,5.6-1.58,1.88-.46,3.77-.87,5.65-1.27h0s.12,4.36.12,4.36c-7.46-.84-15.01-1.24-22.56-1.49-7.55-.23-15.12-.28-22.68-.18h0c-1.53.06-2.83-1.13-2.89-2.66-.05-1.21.68-2.28,1.75-2.7l.41-.16c4.78-1.89,9.68-3.34,14.63-4.67,4.93-1.36,9.91-2.59,14.92-3.67,5.02-1.05,10.06-2.01,15.15-2.75,5.09-.74,10.2-1.33,15.35-1.61h0s-.02,6.63-.02,6.63l-22.71-1.64c-7.57-.53-15.14-.95-22.74-1.22-3.8-.1-7.6-.18-11.4-.22h-5.71s-5.72.09-5.72.09c-7.63.15-15.27.55-22.95,1.1,7.41-2.12,14.99-3.64,22.63-4.81l5.75-.79c1.92-.23,3.84-.43,5.77-.63l5.78-.51,5.8-.35c7.73-.42,15.49-.44,23.22-.09,7.73.4,15.45,1.1,23.08,2.44h.06c1.83.33,3.04,2.07,2.72,3.9-.26,1.45-1.42,2.52-2.8,2.74h0c-4.95.88-9.89,1.74-14.83,2.68-4.94.93-9.88,1.87-14.81,2.88l-14.81,3.03c-4.93,1.06-9.87,2.14-14.9,2.91l-.74-5.52h0c7.64.1,15.27.35,22.91.79,7.63.45,15.26,1.06,22.89,2.12h.05c1.21.17,2.05,1.29,1.88,2.49-.14.97-.89,1.71-1.81,1.87h0c-3.71.64-7.41,1.32-11.04,2.19-1.82.44-3.61.93-5.39,1.5-1.79.54-3.5,1.25-5.29,1.84l.84-1.76c.11.62.17,1.26.23,1.89.06.63.11,1.27.16,1.91.08,1.28.15,2.57.13,3.87Z"/></svg>
            </div>
          </div>
          <div className="mb-6">
            <label className={`block text-lg font-semibold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Select Category</label>
            <div className="grid grid-cols-2 gap-3">
              <style>{`
                @keyframes iconWobble {
                  0%, 100% { transform: rotate(-10deg); }
                  50%       { transform: rotate( 10deg); }
                }
                .icon-wobble { animation: iconWobble 0.9s steps(1, end) infinite; }
              `}</style>
              
              {categories.map(cat => (
                <button key={cat.value} onClick={() => setCategory(cat.value)}
                  className={`p-4 rounded-lg border-2 transition-all ${category === cat.value ? 'border-indigo-500 bg-indigo-50 shadow-md' : `${darkMode ? 'border-gray-600 bg-gray-700 hover:border-indigo-400' : 'border-gray-200 bg-white hover:border-indigo-300'}`}`}>
                  <div className={`text-3xl mb-1 ${category === cat.value ? 'icon-wobble' : ''}`}>{cat.emoji}</div>
                  <div className={`font-semibold ${darkMode && category !== cat.value ? 'text-gray-200' : 'text-gray-700'}`}>{cat.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="mb-6">
            <label className={`block text-lg font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Players</label>
            <div className="flex gap-2 mb-2">
              <input type="text" placeholder="Enter player name" maxLength={12}
                className={`flex-1 px-4 py-2 border-2 rounded-lg focus:border-indigo-400 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400' : 'border-gray-200 bg-white'}`}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    const newName = e.target.value.trim().replace(/[^a-zA-Z0-9]/g, '');
                    if (!newName) { alert('Name must contain letters or numbers!'); return; }
                    if (players.includes(newName)) { alert('A player with this name already exists!'); return; }
                    setPlayers([...players, newName]);
                    e.target.value = '';
                  }
                }}
                onChange={(e) => { e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, ''); }}
              />
              <button onClick={(e) => {
                const input = e.target.previousSibling;
                const newName = input.value.trim().replace(/[^a-zA-Z0-9]/g, '');
                if (newName) {
                  if (players.includes(newName)) { alert('A player with this name already exists!'); return; }
                  setPlayers([...players, newName]);
                  input.value = '';
                }
              }} className="px-6 py-2 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition-colors">Add</button>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {players.map((p, i) => (
                <div key={i} className={`${darkMode ? 'bg-gray-700' : 'bg-gradient-to-r from-indigo-100 to-purple-100'} px-4 py-2 rounded-full flex items-center gap-2`}>
                  <span className={`font-medium ${darkMode ? 'text-gray-200' : ''}`}>{p}</span>
                  <button onClick={() => setPlayers(players.filter((_, idx) => idx !== i))} className="text-red-500 font-bold hover:text-red-700">×</button>
                </div>
              ))}
            </div>
          </div>
          <button onClick={startGame} disabled={players.length < 2}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-bold text-xl hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105">
            Start Game
          </button>
        </div>
      </div>

      {/* ── Settings Modal ── */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto`}>
            <div className={`flex justify-between items-center p-6 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Settings</h2>
              <button onClick={() => setShowSettings(false)}
                className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'} transition-colors text-xl leading-none`}>
                ✕
              </button>
            </div>
            <div className="p-6 space-y-6">

              {/* Rounds */}
              <div>
                <label className={`block text-base font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Rounds</label>
                <input type="number" min="1" max="5" value={maxRounds}
                  onChange={(e) => setMaxRounds(parseInt(e.target.value))}
                  className={`w-full px-4 py-2 border-2 rounded-lg focus:border-indigo-400 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'border-gray-200 bg-white'}`} />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {maxRounds * players.length} total drawings · ~{Math.floor(maxRounds * players.length * (drawingTime + 30) / 60)} min
                </p>
              </div>

              {/* Drawing Time */}
              <div>
                <label className={`block text-base font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Drawing Time <span className="font-bold text-indigo-500">{drawingTime}s</span>
                </label>
                <input type="range" min="30" max="120" step="15" value={drawingTime}
                  onChange={(e) => setDrawingTime(parseInt(e.target.value))}
                  className="w-full" />
                <div className={`flex justify-between text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <span>30s</span><span>45s</span><span>1m</span><span>1:15</span><span>1:30</span><span>1:45</span><span>2m</span>
                </div>
              </div>

              {/* Hints */}
              <div>
                <label className={`block text-base font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Hints</label>
                <div className="flex gap-2">
                  {[
                    { label: 'None', active: !hintsEnabled,                          onClick: () => setHintsEnabled(false) },
                    { label: 'Few',  active: hintsEnabled && hintFraction === 0.25,  onClick: () => { setHintsEnabled(true); setHintFraction(0.25); } },
                    { label: 'Some', active: hintsEnabled && hintFraction === 0.5,   onClick: () => { setHintsEnabled(true); setHintFraction(0.5);  } },
                    { label: 'Lots', active: hintsEnabled && hintFraction === 0.75,  onClick: () => { setHintsEnabled(true); setHintFraction(0.75); } },
                  ].map(({ label, active, onClick }) => (
                    <button key={label} onClick={onClick}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                        active
                          ? 'bg-indigo-500 border-indigo-500 text-white'
                          : `${darkMode ? 'border-gray-600 text-gray-300 hover:border-indigo-400' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {hintsEnabled ? 'Reveals letters spaced evenly through the round, keeping at least one hidden.' : 'No letters revealed.'}
                </p>
              </div>

              {/* Transparency */}
              <div className={`flex items-center justify-between py-3 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                <div>
                  <p className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Transparent drawings</p>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Save PNGs without white background</p>
                </div>
                <button onClick={() => setSaveWithTransparency(!saveWithTransparency)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${saveWithTransparency ? 'bg-indigo-500' : darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${saveWithTransparency ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Custom Prompt Pack */}
              <div className={`pt-3 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Custom Prompt Pack</p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Upload a .txt file with your own prompts</p>
                  </div>
                  <button onClick={() => setUseCustomPrompts(!useCustomPrompts)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${useCustomPrompts ? 'bg-indigo-500' : darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${useCustomPrompts ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {useCustomPrompts && (
                  <div className="space-y-3">
                    <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${darkMode ? 'border-gray-600 hover:border-indigo-400 bg-gray-700' : 'border-gray-300 hover:border-indigo-400'}`}>
                      <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" id="promptFile" />
                      <label htmlFor="promptFile" className="cursor-pointer">
                        <div className="text-3xl mb-1">📄</div>
                        <div className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                          {customPrompts ? 'Pack loaded ✓ — click to change' : 'Click to upload prompt pack'}
                        </div>
                      </label>
                    </div>
                    <details className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-3`}>
                      <summary className={`cursor-pointer font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} text-xs`}>📝 Format guide</summary>
                      <div className={`mt-2 text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'} space-y-1`}>
                        <p className={`font-mono ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} p-2 rounded border whitespace-pre text-xs`}>{"[Animals]\nEasy:\nelephant\nMedium:\noctopus\nHard:\naxolotl"}</p>
                        <p>Categories: animals, food, places, objects, popculture, general</p>
                      </div>
                    </details>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  // ─── Game End Screen ─────────────────────────────────────────────────────────

  if (gameState === 'gameEnd') {
    const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100'} p-8`}>
        <div className={`max-w-4xl mx-auto ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8`}>
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Game Complete!</h1>
            <button onClick={() => setDarkMode(!darkMode)} className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'} transition-colors`} title="Toggle dark mode"><span className="flex items-center">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</span></button>
          </div>
          <div className="mb-8">
            <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Final Scores</h2>
            {sortedScores.map(([player, score], i) => (
              <div key={player} className={`flex justify-between items-center p-4 mb-2 ${darkMode ? 'bg-gray-700' : 'bg-gradient-to-r from-indigo-50 to-purple-50'} rounded-lg`}>
                <span className={`text-xl font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{i === 0 && '🏆 '}{player}</span>
                <span className="text-2xl font-bold text-indigo-600">{score}</span>
              </div>
            ))}
          </div>
          <div className="mb-8">
            <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Save your favorite drawings!</h2>
            <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {drawings.map((drawing, i) => (
                <div key={i} className={`border-2 ${darkMode ? 'border-gray-600' : 'border-gray-200'} rounded-lg p-3 hover:shadow-lg transition-shadow`}>
                  <img src={drawing.image} alt={drawing.prompt} className="w-full mb-2 rounded" />
                  <div className="flex justify-between items-center">
                    <div>
                      <div className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>"{drawing.prompt}"</div>
                      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} capitalize`}>by {drawing.drawer} • {drawing.difficulty}</div>
                    </div>
                    <button onClick={() => downloadDrawing(drawing)} className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"><Download size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => { setGameState('setup'); setDrawings([]); setUsedPrompts(new Set()); }}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-bold text-xl hover:from-indigo-600 hover:to-purple-600 transition-all transform hover:scale-105">
            New Game
          </button>
        </div>
      </div>
    );
  }

  // ─── Round End Screen ─────────────────────────────────────────────────────────

  if (gameState === 'roundEnd') {
    const wasSkipped = !currentPrompt;
    const isLastRound = round >= maxRounds * players.length;
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100'} flex items-center justify-center`}>
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-12 text-center max-w-2xl`}>
          {wasSkipped ? (
            <>
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">Time's Up!</h1>
              <p className={`text-2xl mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{players[currentDrawer]} didn't pick a prompt in time</p>
              {!isLastRound && <p className={`text-md ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-4`}>Next round starting...</p>}
            </>
          ) : (
            <>
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Round Over!</h1>
              <p className={`text-2xl mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>The prompt was: <span className="font-bold text-indigo-600">{currentPrompt?.prompt}</span></p>
              <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-4 capitalize`}>Difficulty: {currentPrompt?.difficulty}</p>
              {correctGuessers.length > 0 ? (
                <div className="text-lg text-green-600 font-semibold">Correct guessers: {correctGuessers.join(', ')}</div>
              ) : (
                <div className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No one guessed correctly!</div>
              )}
              {!isLastRound && <p className={`text-md ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-4`}>Next round starting...</p>}
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Playing Screen ───────────────────────────────────────────────────────────

  const drawerName = players[currentDrawer];

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100'} p-4`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-4 mb-4 flex justify-between items-center`}>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">LAGANEA</h1>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Round {round} of {maxRounds * players.length} • {categories.find(c => c.value === category)?.emoji} {categories.find(c => c.value === category)?.label}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setDarkMode(!darkMode)} className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'} transition-colors`} title="Toggle dark mode">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => { setIsPaused(!isPaused); setShowQuitConfirm(false); }}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${isPaused ? 'bg-gray-400 text-white cursor-default' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}`}
              disabled={isPaused}>
              {isPaused ? 'Paused' : '⏸ Pause'}
            </button>
            <div className="text-right">
              <div className="text-3xl font-bold text-indigo-600">{currentPrompt ? timeLeft : drawingTime}s</div>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Drawer: {drawerName}</div>
            </div>
          </div>
        </div>

        {/* Pause Overlay */}
        {isPaused && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl p-8 text-center max-w-lg w-full mx-4`}>
              {showQuitConfirm ? (
                <>
                  <h2 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Quit to menu?</h2>
                  <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {drawings.length > 0 ? 'Save any drawings you want to keep first.' : 'All current game progress will be lost.'}
                  </p>
                  {drawings.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-5 max-h-56 overflow-y-auto">
                      {drawings.map((drawing, i) => (
                        <div key={i} className={`border-2 ${darkMode ? 'border-gray-600' : 'border-gray-200'} rounded-lg p-2`}>
                          <img src={drawing.image} alt={drawing.prompt} className="w-full mb-1 rounded" />
                          <div className="flex justify-between items-center">
                            <div className={`text-xs font-semibold truncate ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>"{drawing.prompt}"</div>
                            <button onClick={() => downloadDrawing(drawing)} className="p-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors flex-shrink-0 ml-1">
                              <Download size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => {
                      setShowQuitConfirm(false); setIsPaused(false); setGameState('setup');
                      setCurrentPrompt(null); setPromptOptions([]); setGuesses([]); setCorrectGuessers([]);
                      setRound(1); setCurrentDrawer(0); setTimeLeft(90); setPromptSelectionTime(30);
                      setRevealedLetters([]); setShowClearDialog(false); setShowColorPicker(false);
                      setDrawings([]); setUsedPrompts(new Set()); clearCanvasInternal();
                    }} className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-colors">
                      Quit
                    </button>
                    <button onClick={() => setShowQuitConfirm(false)} className={`px-6 py-3 rounded-lg font-bold transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className={`text-4xl font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>⏸ Game Paused</h2>
                  <p className={`text-lg mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Take a break!</p>
                  <div className="flex flex-col gap-3">
                    <button onClick={() => { setIsPaused(false); setShowQuitConfirm(false); }} className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-xl transition-colors">▶ Resume Game</button>
                    <button onClick={() => setShowQuitConfirm(true)} className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-colors">Quit to Menu</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 h-[calc(100vh-12rem)]">
          {/* Drawing Area */}
          <div className="col-span-2 flex flex-col h-full">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-4 flex-1 flex flex-col`}>
              {!currentPrompt ? (
                <div className={`mb-4 p-6 ${darkMode ? 'bg-gray-700' : 'bg-gradient-to-r from-indigo-50 to-purple-50'} rounded-lg flex-shrink-0`}>
                  <div className="flex justify-between items-center mb-4">
                    <p className={`text-xl font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Choose your prompt:</p>
                    {!generatingPrompts && promptOptions.length > 0 && (
                      <div>
                        <div className="text-2xl font-bold text-red-500">{promptSelectionTime}s</div>
                        <div className="text-xs text-gray-500 text-right">before skip</div>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {(promptOptions.length > 0 ? promptOptions : [{prompt:'',difficulty:'easy'},{prompt:'',difficulty:'medium'},{prompt:'',difficulty:'hard'}]).map((opt, i) => (
                      <button key={i} onClick={() => !generatingPrompts && opt.prompt && selectPrompt(opt)} disabled={generatingPrompts || !opt.prompt}
                        className={`p-4 rounded-lg border-2 transition-all ${generatingPrompts || !opt.prompt ? 'bg-gray-100 border-gray-200 cursor-wait' :
                          opt.difficulty === 'easy' ? 'bg-green-50 border-green-200 hover:border-indigo-500' :
                          opt.difficulty === 'medium' ? 'bg-yellow-50 border-yellow-200 hover:border-indigo-500' :
                          'bg-red-50 border-red-200 hover:border-indigo-500'}`}>
                        {generatingPrompts || !opt.prompt ? (
                          <div className="flex items-center justify-center h-12">
                            <div className="flex gap-1 text-2xl font-bold">
                              <span className="animate-bounce" style={{animationDelay:'0ms'}}>.</span>
                              <span className="animate-bounce" style={{animationDelay:'150ms'}}>.</span>
                              <span className="animate-bounce" style={{animationDelay:'300ms'}}>.</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="font-semibold text-gray-800">{opt.prompt}</div>
                            <div className={`text-xs mt-1 capitalize ${opt.difficulty === 'easy' ? 'text-green-600' : opt.difficulty === 'medium' ? 'text-yellow-600' : 'text-red-600'}`}>
                              {opt.difficulty} • {opt.difficulty === 'easy' ? '100' : opt.difficulty === 'medium' ? '200' : '300'} pts
                            </div>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                  <button onClick={generatePrompts} disabled={generatingPrompts}
                    className={`w-full py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${generatingPrompts ? 'bg-gray-300 text-gray-500 cursor-wait' : darkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                    {generatingPrompts ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex gap-1 text-lg font-bold">
                          <span className="animate-bounce" style={{animationDelay:'0ms'}}>.</span>
                          <span className="animate-bounce" style={{animationDelay:'150ms'}}>.</span>
                          <span className="animate-bounce" style={{animationDelay:'300ms'}}>.</span>
                        </span>
                        <span>Generating prompts...</span>
                      </div>
                    ) : (<><RefreshCw size={16} /> Get new prompts</>)}
                  </button>
                </div>
              ) : (
                <div>
                  <div className={`mb-4 p-4 ${darkMode ? 'bg-gray-700' : 'bg-gradient-to-r from-indigo-50 to-purple-50'} rounded-lg flex-shrink-0`}>
                    <p className={`text-center text-xl font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'} mb-2`}>Draw: {currentPrompt.prompt}</p>
                    <p className={`text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} capitalize`}>{currentPrompt.difficulty} difficulty</p>
                  </div>
                  <div className="mb-4 flex justify-center gap-1 flex-wrap flex-shrink-0 min-h-[52px] items-center">
                    {currentPrompt.prompt.split('').map((char, i) => (
                      <div key={i} className={`${char === ' ' ? 'w-4' : `w-8 h-10 border-2 ${darkMode ? 'border-gray-600' : 'border-gray-300'} rounded flex items-center justify-center font-bold text-xl`}
                        ${revealedLetters.includes(i) ? 'bg-yellow-100 text-gray-800' : `${darkMode ? 'bg-gray-700 text-transparent' : 'bg-white text-transparent'}`}`}>
                        {char === ' ' ? '' : revealedLetters.includes(i) ? char : '_'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Drawing Tools ── */}
              <div className={`flex gap-2 mb-4 flex-wrap items-center flex-shrink-0 ${!currentPrompt ? 'pointer-events-none opacity-30' : ''}`}>
                <button onClick={() => { setTool('pen'); setIsPickingColor(false); setShowColorPicker(false); }}
                  className={`p-2 rounded transition-colors ${tool === 'pen' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700'}`} title="Pen">
                  <Pencil size={20} />
                </button>
                <button onClick={() => { setTool('eraser'); setIsPickingColor(false); setShowColorPicker(false); }}
                  className={`p-2 rounded transition-colors ${tool === 'eraser' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700'}`} title="Eraser">
                  <Eraser size={20} />
                </button>
                <button onClick={() => { setTool('fill'); setIsPickingColor(false); setShowColorPicker(false); }}
                  className={`p-2 rounded transition-colors ${tool === 'fill' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700'}`} title="Bucket Fill">
                  <PaintBucket size={20} />
                </button>
                <button onClick={() => { setIsPickingColor(!isPickingColor); setShowColorPicker(false); }}
                  className={`p-2 rounded transition-colors ${isPickingColor ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700'}`} title="Eyedropper">
                  <Pipette size={20} />
                </button>
                <button onClick={clearCanvas} className="p-2 rounded bg-red-500 text-white hover:bg-red-600 transition-colors" title="Clear Canvas">
                  <Trash2 size={20} />
                </button>

                <div className="h-8 w-px bg-gray-300 mx-1"></div>

                {/* Base color swatches */}
                <div className="flex gap-1 flex-wrap">
                  {baseColors.map(c => (
                    <button key={c} onClick={() => { setColor(c); setCustomColor(c); setIsPickingColor(false); setShowColorPicker(false); }}
                      className={`w-7 h-7 rounded border-2 transition-all hover:scale-110 ${color === c ? 'border-indigo-500 shadow-md' : 'border-gray-300'}`}
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>

                {/* Custom color picker trigger */}
                <div className="relative" ref={paletteButtonRef}>
                  <button
                    onClick={() => { setShowColorPicker(!showColorPicker); setIsPickingColor(false); }}
                    title="Custom Color Picker"
                    style={{
                      position: 'relative',
                      width: 36,
                      height: 32,
                      borderRadius: 6,
                      border: showColorPicker ? '2px solid #6366f1' : '2px solid #d1d5db',
                      background: '#fff',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'border-color 0.15s',
                      padding: 0,
                    }}
                  >
                    <Palette size={16} style={{ color: '#4b5563', position: 'absolute', top: 4 }} />
                    {/* Color swatch strip at bottom */}
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 9,
                      backgroundColor: customColor,
                    }} />
                  </button>

                  {/* The custom color picker popup */}
                  {showColorPicker && (
                    <ColorPickerPopup
                      color={customColor}
                      darkMode={darkMode}
                      triggerRef={paletteButtonRef}
                      onChange={(hex) => {
                        setColor(hex);
                        setCustomColor(hex);
                      }}
                      onClose={() => setShowColorPicker(false)}
                    />
                  )}
                </div>

                <div className="h-8 w-px bg-gray-300 mx-1"></div>

                <input type="range" min="1" max="100" value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="flex-1 min-w-[100px]" />
                <span className="text-sm text-gray-600 font-medium min-w-[60px]">Size: {brushSize}</span>
              </div>

              <div className="overflow-auto relative flex-1 flex items-center justify-center">
                {/* Clear Canvas Dialog */}
                {showClearDialog && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 rounded-lg">
                    <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-2xl p-8 text-center max-w-sm`}>
                      <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Clear canvas?</h3>
                      <p className={`mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>This cannot be undone.</p>
                      <div className="flex gap-4 justify-center">
                        <button onClick={confirmClearCanvas} className="px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors flex items-center gap-2">✓ Clear</button>
                        <button onClick={() => setShowClearDialog(false)} className={`px-6 py-3 rounded-lg font-semibold transition-colors ${darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>✗ Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className={`border-4 ${darkMode ? 'border-gray-600' : 'border-indigo-200'} bg-white rounded-lg ${(isPickingColor || tool === 'fill') ? 'cursor-crosshair' : 'canvas-cursor'} ${!currentPrompt ? 'pointer-events-none opacity-30' : ''}`}
                  style={{ maxWidth: '100%', height: 'auto', backgroundColor: '#ffffff' }}
                  onMouseDown={startDrawing}
                  onMouseMove={(e) => {
                    draw(e);
                    const preview = document.getElementById('pen-preview');
                    const canvas = canvasRef.current;
                    if (preview && !isPickingColor && tool !== 'fill' && currentPrompt && canvas) {
                      const rect = canvas.getBoundingClientRect();
                      const scaleX = rect.width / canvas.width;
                      const scaleY = rect.height / canvas.height;
                      preview.style.left = `${e.clientX - rect.left}px`;
                      preview.style.top = `${e.clientY - rect.top}px`;
                      preview.style.width = `${brushSize * (tool === 'eraser' ? 2 : 1) * scaleX}px`;
                      preview.style.height = `${brushSize * (tool === 'eraser' ? 2 : 1) * scaleY}px`;
                      preview.style.backgroundColor = tool === 'eraser' ? 'rgba(255,255,255,0.7)' : color + '80';
                      preview.style.display = 'block';
                    }
                  }}
                  onMouseUp={stopDrawing}
                  onMouseLeave={() => {
                    const preview = document.getElementById('pen-preview');
                    if (preview) preview.style.display = 'none';
                  }}
                  onMouseEnter={(e) => {
                    handleMouseEnter(e);
                    const preview = document.getElementById('pen-preview');
                    if (preview && !isPickingColor && tool !== 'fill' && currentPrompt) preview.style.display = 'block';
                  }}
                />
                <div id="pen-preview" style={{
                  position: 'absolute', pointerEvents: 'none', borderRadius: '50%',
                  border: '1px solid rgba(0,0,0,0.5)', transform: 'translate(-50%,-50%)',
                  display: 'none', zIndex: 1000
                }} />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-1 flex flex-col h-full">
            {/* Scores */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-4 flex flex-col`} style={{ height: '40%' }}>
              <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-700'} flex-shrink-0`}>Scores</h2>
              <div className="overflow-y-auto flex-1">
                {players.map(p => (
                  <div key={p} className={`flex justify-between py-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'} last:border-0`}>
                    <span className={currentDrawer === players.indexOf(p) ? 'font-bold text-indigo-600' : `${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {p} {currentDrawer === players.indexOf(p) && '🎨'}
                      {correctGuessers.includes(p) && ' ✓'}
                    </span>
                    <span className={`font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{scores[p] || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Guesses */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-4 flex flex-col mt-4`} style={{ height: 'calc(60% - 1rem)' }}>
              <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-700'} flex-shrink-0`}>Guesses</h2>
              <div className={`mb-3 overflow-y-auto flex-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-3 space-y-2`}>
                {guesses.map((g, i) => (
                  <div key={i} className={`text-sm p-2 rounded ${g.correct ? 'bg-green-100 text-green-800 font-bold' : 'bg-white text-gray-700'}`}>
                    <span className="font-semibold">{g.player}:</span> {g.text}
                    {g.correct && <span className="ml-2">✓ {correctGuessers.indexOf(g.player) === 0 && '🥇'}</span>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <input type="text" value={guess} onChange={(e) => setGuess(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && submitGuess()}
                  placeholder="Type your guess..."
                  className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-400 focus:outline-none" />
                <button onClick={submitGuess} className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition-colors">Send</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SketchHeadsGame;
