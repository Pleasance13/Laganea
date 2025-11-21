  const parseCustomPromptFile = (text) => {
    const packs = {};
    const lines = text.split('\n');
    let currentCategory = null;
    let currentDifficulty = null;
    
    const validCategories = ['animals', 'food', 'places', 'objects', 'popculture', 'general'];
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      // Check if it's a category header [Category]
      const categoryMatch = line.match(/^\[(.*)\]$/);
      if (categoryMatch) {
        let cat = categoryMatch[1].toLowerCase();
        // If not a valid category, put it in general
        if (!validCategories.includes(cat)) {
          cat = 'general';
        }
        currentCategory = cat;
        if (!packs[currentCategory]) {
          packs[currentCategory] = { easy: [], medium: [], hard: [] };
        }
        continue;
      }
      
      // Check if it's a difficulty header
      if (line.match(/^Easy:\s*$/i)) {
        currentDifficulty = 'easy';
        continue;
      }
      if (line.match(/^Medium:\s*$/i)) {
        currentDifficulty = 'medium';
        continue;
      }
      if (line.match(/^Hard:\s*$/i)) {
        currentDifficulty = 'hard';
        continue;
      }
      
      // It's a prompt
      if (currentCategory && currentDifficulty) {
        packs[currentCategory][currentDifficulty].push({
          prompt: line,
          difficulty: currentDifficulty
        });
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
      setCustomPrompts(text); // Store for display
    };
    reader.readAsText(file);
  };

  const getAvailableCustomPrompts = (cat, difficulty) => {
    if (!useCustomPrompts || !customPromptPacks) return [];
    
    // For general category, include all custom prompts
    if (cat === 'general') {
      const allPrompts = [];
      Object.values(customPromptPacks).forEach(pack => {
        if (pack[difficulty]) {
          allPrompts.push(...pack[difficulty]);
        }
      });
      return allPrompts;
    }
    
    // For specific category, get prompts from that category
    if (customPromptPacks[cat] && customPromptPacks[cat][difficulty]) {
      return customPromptPacks[cat][difficulty];
    }
    
    return [];
  };import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Eraser, Trash2, Download, RefreshCw, Pipette, Palette } from 'lucide-react';

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
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [correctGuessers, setCorrectGuessers] = useState([]);
  const [promptSelectionTime, setPromptSelectionTime] = useState(30);
  const [usedPrompts, setUsedPrompts] = useState(new Set());
  const [hintsEnabled, setHintsEnabled] = useState(true);
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
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  useEffect(() => {
    if (isPaused) return; // Don't run timers when paused
    
    if (gameState === 'playing' && currentPrompt && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
        
        // Reveal hints every 15 seconds if enabled
        if (hintsEnabled && timeLeft % 15 === 0 && timeLeft !== 90) {
          revealNextLetter();
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
    
    // Find all letter positions (not spaces or special chars)
    for (let i = 0; i < prompt.length; i++) {
      if (prompt[i].match(/[a-zA-Z]/)) {
        letterIndices.push(i);
      }
    }
    
    // Find unrevealed letters
    const unrevealedIndices = letterIndices.filter(i => !revealedLetters.includes(i));
    
    if (unrevealedIndices.length > 0) {
      // Pick a random unrevealed letter
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

  const generatePrompts = async () => {
    setGeneratingPrompts(true);
    
    // Build pool of available prompts for each difficulty
    const promptsByDifficulty = {
      easy: [],
      medium: [],
      hard: []
    };
    
    // Add custom prompts if enabled
    if (useCustomPrompts && Object.keys(customPromptPacks).length > 0) {
      try {
        ['easy', 'medium', 'hard'].forEach(diff => {
          const customPromptsForDiff = getAvailableCustomPrompts(category, diff)
            .filter(p => !usedPrompts.has(p.prompt.toLowerCase()));
          promptsByDifficulty[diff].push(...customPromptsForDiff);
        });
      } catch (error) {
        console.error('Error loading custom prompts:', error);
      }
    }
    
    // Always try to get AI prompts too (will mix with custom)
    const maxAttempts = 3;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
2. NO ADJECTIVE + NOUN combinations - "feather tickler" is WRONG, "tickler" is correct
3. NO ACTION PHRASES - "spilling the beans" is WRONG
4. NO VERB PHRASES - "eating pizza" is WRONG  
5. NO DESCRIPTIVE SCENES - "melting snowman" is WRONG
6. CORRECT examples: "elephant", "pizza", "Hogwarts", "Batman", "volcano"
7. Each prompt must be drawable as a THING, not an ACTION
8. Do NOT repeat any of these prompts: ${Array.from(usedPrompts).join(', ')}
9. Be creative and generate UNIQUE prompts not in the avoid list
10. Think of uncommon but drawable nouns

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
        
        // Filter out any used prompts and validate they're good
        const newPrompts = prompts.filter(p => {
          const promptLower = p.prompt.toLowerCase();
          // Check if already used
          if (usedPrompts.has(promptLower)) return false;
          // Check if it's a single word or proper noun (allowed to have spaces)
          const words = p.prompt.split(' ');
          if (words.length === 1) return true;
          // If multiple words, must start with capital letter (proper noun)
          return words[0][0] === words[0][0].toUpperCase();
        });
        
        // Mix in custom prompts if available
        ['easy', 'medium', 'hard'].forEach(diff => {
          const customForDiff = getAvailableCustomPrompts(category, diff)
            .filter(p => !usedPrompts.has(p.prompt.toLowerCase()));
          const aiForDiff = newPrompts.filter(p => p.difficulty === diff);
          promptsByDifficulty[diff].push(...customForDiff, ...aiForDiff);
        });
        
        // ALWAYS select exactly one from each difficulty
        if (promptsByDifficulty.easy.length > 0 && 
            promptsByDifficulty.medium.length > 0 && 
            promptsByDifficulty.hard.length > 0) {
          
          // Create a set to track selected prompts to avoid duplicates
          const selectedPrompts = new Set();
          const selected = [];
          
          // Select easy
          const easyOptions = promptsByDifficulty.easy.filter(p => !selectedPrompts.has(p.prompt.toLowerCase()));
          if (easyOptions.length > 0) {
            const easyPrompt = easyOptions[Math.floor(Math.random() * easyOptions.length)];
            selected.push(easyPrompt);
            selectedPrompts.add(easyPrompt.prompt.toLowerCase());
          }
          
          // Select medium (excluding already selected)
          const mediumOptions = promptsByDifficulty.medium.filter(p => !selectedPrompts.has(p.prompt.toLowerCase()));
          if (mediumOptions.length > 0) {
            const mediumPrompt = mediumOptions[Math.floor(Math.random() * mediumOptions.length)];
            selected.push(mediumPrompt);
            selectedPrompts.add(mediumPrompt.prompt.toLowerCase());
          }
          
          // Select hard (excluding already selected)
          const hardOptions = promptsByDifficulty.hard.filter(p => !selectedPrompts.has(p.prompt.toLowerCase()));
          if (hardOptions.length > 0) {
            const hardPrompt = hardOptions[Math.floor(Math.random() * hardOptions.length)];
            selected.push(hardPrompt);
            selectedPrompts.add(hardPrompt.prompt.toLowerCase());
          }
          
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
    
    // Fallback prompts - expanded list with more variety
    const fallbacks = {
      general: [
        {prompt: 'telescope', difficulty: 'easy'}, {prompt: 'bridge', difficulty: 'easy'}, {prompt: 'waterfall', difficulty: 'easy'},
        {prompt: 'anchor', difficulty: 'easy'}, {prompt: 'compass', difficulty: 'easy'}, {prompt: 'lantern', difficulty: 'easy'},
        {prompt: 'rainbow', difficulty: 'medium'}, {prompt: 'sunrise', difficulty: 'medium'}, {prompt: 'thunderstorm', difficulty: 'medium'},
        {prompt: 'eclipse', difficulty: 'medium'}, {prompt: 'tornado', difficulty: 'medium'}, {prompt: 'meteor', difficulty: 'medium'},
        {prompt: 'kaleidoscope', difficulty: 'hard'}, {prompt: 'constellation', difficulty: 'hard'}, {prompt: 'aurora', difficulty: 'hard'},
        {prompt: 'prism', difficulty: 'hard'}, {prompt: 'labyrinth', difficulty: 'hard'}, {prompt: 'obelisk', difficulty: 'hard'}
      ],
      animals: [
        {prompt: 'elephant', difficulty: 'easy'}, {prompt: 'penguin', difficulty: 'easy'}, {prompt: 'dolphin', difficulty: 'easy'},
        {prompt: 'turtle', difficulty: 'easy'}, {prompt: 'rabbit', difficulty: 'easy'}, {prompt: 'squirrel', difficulty: 'easy'},
        {prompt: 'butterfly', difficulty: 'medium'}, {prompt: 'chameleon', difficulty: 'medium'}, {prompt: 'peacock', difficulty: 'medium'},
        {prompt: 'seahorse', difficulty: 'medium'}, {prompt: 'porcupine', difficulty: 'medium'}, {prompt: 'armadillo', difficulty: 'medium'},
        {prompt: 'octopus', difficulty: 'hard'}, {prompt: 'platypus', difficulty: 'hard'}, {prompt: 'axolotl', difficulty: 'hard'},
        {prompt: 'narwhal', difficulty: 'hard'}, {prompt: 'pangolin', difficulty: 'hard'}, {prompt: 'cassowary', difficulty: 'hard'}
      ],
      food: [
        {prompt: 'pizza', difficulty: 'easy'}, {prompt: 'burger', difficulty: 'easy'}, {prompt: 'hotdog', difficulty: 'easy'},
        {prompt: 'apple', difficulty: 'easy'}, {prompt: 'cookie', difficulty: 'easy'}, {prompt: 'donut', difficulty: 'easy'},
        {prompt: 'sushi', difficulty: 'medium'}, {prompt: 'tacos', difficulty: 'medium'}, {prompt: 'ramen', difficulty: 'medium'},
        {prompt: 'pretzel', difficulty: 'medium'}, {prompt: 'bagel', difficulty: 'medium'}, {prompt: 'waffle', difficulty: 'medium'},
        {prompt: 'croissant', difficulty: 'hard'}, {prompt: 'tiramisu', difficulty: 'hard'}, {prompt: 'macarons', difficulty: 'hard'},
        {prompt: 'baklava', difficulty: 'hard'}, {prompt: 'pavlova', difficulty: 'hard'}, {prompt: 'beignet', difficulty: 'hard'}
      ],
      places: [
        {prompt: 'castle', difficulty: 'easy'}, {prompt: 'lighthouse', difficulty: 'easy'}, {prompt: 'volcano', difficulty: 'easy'},
        {prompt: 'cave', difficulty: 'easy'}, {prompt: 'tower', difficulty: 'easy'}, {prompt: 'temple', difficulty: 'easy'},
        {prompt: 'pyramid', difficulty: 'medium'}, {prompt: 'windmill', difficulty: 'medium'}, {prompt: 'Big Ben', difficulty: 'medium'},
        {prompt: 'igloo', difficulty: 'medium'}, {prompt: 'pagoda', difficulty: 'medium'}, {prompt: 'canyon', difficulty: 'medium'},
        {prompt: 'Colosseum', difficulty: 'hard'}, {prompt: 'Taj Mahal', difficulty: 'hard'}, {prompt: 'Stonehenge', difficulty: 'hard'},
        {prompt: 'Parthenon', difficulty: 'hard'}, {prompt: 'Angkor Wat', difficulty: 'hard'}, {prompt: 'Neuschwanstein', difficulty: 'hard'}
      ],
      objects: [
        {prompt: 'umbrella', difficulty: 'easy'}, {prompt: 'bicycle', difficulty: 'easy'}, {prompt: 'crown', difficulty: 'easy'},
        {prompt: 'shield', difficulty: 'easy'}, {prompt: 'basket', difficulty: 'easy'}, {prompt: 'ladder', difficulty: 'easy'},
        {prompt: 'telescope', difficulty: 'medium'}, {prompt: 'compass', difficulty: 'medium'}, {prompt: 'binoculars', difficulty: 'medium'},
        {prompt: 'harmonica', difficulty: 'medium'}, {prompt: 'tambourine', difficulty: 'medium'}, {prompt: 'pendulum', difficulty: 'medium'},
        {prompt: 'microscope', difficulty: 'hard'}, {prompt: 'hourglass', difficulty: 'hard'}, {prompt: 'metronome', difficulty: 'hard'},
        {prompt: 'sextant', difficulty: 'hard'}, {prompt: 'astrolabe', difficulty: 'hard'}, {prompt: 'periscope', difficulty: 'hard'}
      ],
      popculture: [
        {prompt: 'lightsaber', difficulty: 'easy'}, {prompt: 'Batmobile', difficulty: 'easy'}, {prompt: 'Triforce', difficulty: 'easy'},
        {prompt: 'wand', difficulty: 'easy'}, {prompt: 'cape', difficulty: 'easy'}, {prompt: 'shield', difficulty: 'easy'},
        {prompt: 'Pokéball', difficulty: 'medium'}, {prompt: 'DeLorean', difficulty: 'medium'}, {prompt: 'Infinity Gauntlet', difficulty: 'medium'},
        {prompt: 'Batcave', difficulty: 'medium'}, {prompt: 'Tardis', difficulty: 'medium'}, {prompt: 'Batmobile', difficulty: 'medium'},
        {prompt: 'Mjolnir', difficulty: 'hard'}, {prompt: 'Excalibur', difficulty: 'hard'}, {prompt: 'One Ring', difficulty: 'hard'},
        {prompt: 'Millennium Falcon', difficulty: 'hard'}, {prompt: 'Enterprise', difficulty: 'hard'}, {prompt: 'Gryffindor', difficulty: 'hard'}
      ]
    };
    
    // Use fallback prompts and ensure one of each difficulty
    // Use fallback prompts and ensure one of each difficulty
    const categoryFallbacks = fallbacks[category] || fallbacks.general;
    
    // Separate by difficulty
    const easyFallbacks = categoryFallbacks.filter(p => p.difficulty === 'easy' && !usedPrompts.has(p.prompt.toLowerCase()));
    const mediumFallbacks = categoryFallbacks.filter(p => p.difficulty === 'medium' && !usedPrompts.has(p.prompt.toLowerCase()));
    const hardFallbacks = categoryFallbacks.filter(p => p.difficulty === 'hard' && !usedPrompts.has(p.prompt.toLowerCase()));
    
    // Add custom prompts to each difficulty pool
    if (useCustomPrompts) {
      easyFallbacks.push(...getAvailableCustomPrompts(category, 'easy').filter(p => !usedPrompts.has(p.prompt.toLowerCase())));
      mediumFallbacks.push(...getAvailableCustomPrompts(category, 'medium').filter(p => !usedPrompts.has(p.prompt.toLowerCase())));
      hardFallbacks.push(...getAvailableCustomPrompts(category, 'hard').filter(p => !usedPrompts.has(p.prompt.toLowerCase())));
    }
    
    // Select one from each difficulty if available
    if (easyFallbacks.length > 0 && mediumFallbacks.length > 0 && hardFallbacks.length > 0) {
      // Track selected prompts to avoid duplicates
      const selectedPrompts = new Set();
      const selected = [];
      
      // Select easy
      const easyOptions = easyFallbacks.filter(p => !selectedPrompts.has(p.prompt.toLowerCase()));
      if (easyOptions.length > 0) {
        const easyPrompt = easyOptions[Math.floor(Math.random() * easyOptions.length)];
        selected.push(easyPrompt);
        selectedPrompts.add(easyPrompt.prompt.toLowerCase());
      }
      
      // Select medium (excluding already selected)
      const mediumOptions = mediumFallbacks.filter(p => !selectedPrompts.has(p.prompt.toLowerCase()));
      if (mediumOptions.length > 0) {
        const mediumPrompt = mediumOptions[Math.floor(Math.random() * mediumOptions.length)];
        selected.push(mediumPrompt);
        selectedPrompts.add(mediumPrompt.prompt.toLowerCase());
      }
      
      // Select hard (excluding already selected)
      const hardOptions = hardFallbacks.filter(p => !selectedPrompts.has(p.prompt.toLowerCase()));
      if (hardOptions.length > 0) {
        const hardPrompt = hardOptions[Math.floor(Math.random() * hardOptions.length)];
        selected.push(hardPrompt);
        selectedPrompts.add(hardPrompt.prompt.toLowerCase());
      }
      
      if (selected.length === 3) {
        setPromptOptions(selected);
        setGeneratingPrompts(false);
        return selected;
      }
    }
    
    // If we don't have enough unused prompts, just shuffle all available
    const shuffled = categoryFallbacks.sort(() => Math.random() - 0.5);
    setPromptOptions(shuffled.slice(0, 3));
    setGeneratingPrompts(false);
    return shuffled.slice(0, 3);
  };

  const startGame = async () => {
    if (players.length < 2) {
      alert('Need at least 2 players!');
      return;
    }
    
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
    clearCanvas();
    setGameState('playing');
    const prompts = await generatePrompts();
    if (prompts) {
      setPromptOptions(prompts);
    }
  };

  const selectPrompt = (promptObj) => {
    setCurrentPrompt(promptObj);
    setTimeLeft(90);
    setBrushSize(3);
    setRevealedLetters([]);
    setShowClearDialog(false);
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
        generatePrompts();
        setGuesses([]);
        setCorrectGuessers([]);
        clearCanvas();
      } else {
        setGameState('gameEnd');
      }
    }, 2000);
  };

  const getDrawing = () => {
    const canvas = canvasRef.current;
    
    if (saveWithTransparency) {
      // Return canvas as-is with transparency
      return canvas.toDataURL('image/png');
    } else {
      // Create a temporary canvas with white background
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      // Fill with white
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Draw the original canvas on top
      tempCtx.drawImage(canvas, 0, 0);
      
      return tempCanvas.toDataURL('image/png');
    }
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
      
      // Award drawer points based on difficulty if someone guessed
      if (correctGuessers.length > 0) {
        const difficultyPoints = {
          easy: 100,
          medium: 200,
          hard: 300
        };
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
        generatePrompts();
        setGuesses([]);
        setCorrectGuessers([]);
        clearCanvas();
      } else {
        setGameState('gameEnd');
      }
    }, 3000);
  };

  const submitGuess = () => {
    if (!guess.trim() || !currentPrompt) return;
    
    const guesserName = players.find((_, i) => i !== currentDrawer) || 'Player';
    
    if (correctGuessers.includes(guesserName)) {
      setGuess('');
      return;
    }
    
    const guessLower = guess.toLowerCase().trim();
    const promptLower = currentPrompt.prompt.toLowerCase().trim();
    
    const isCorrect = guessLower === promptLower;
    
    const newGuess = {
      player: guesserName,
      text: guess,
      time: 90 - timeLeft,
      correct: isCorrect
    };
    
    setGuesses([...guesses, newGuess]);
    
    if (isCorrect) {
      const newCorrectGuessers = [...correctGuessers, guesserName];
      setCorrectGuessers(newCorrectGuessers);
      
      const timeBonus = Math.max(100, 500 - (90 - timeLeft) * 5);
      const positionBonus = newCorrectGuessers.length === 1 ? 200 : 0;
      const totalScore = timeBonus + positionBonus;
      
      setScores(prev => ({
        ...prev,
        [guesserName]: (prev[guesserName] || 0) + totalScore
      }));
      
      // Check if all non-drawer players have guessed correctly
      const nonDrawerPlayers = players.filter((_, i) => i !== currentDrawer);
      if (newCorrectGuessers.length === nonDrawerPlayers.length) {
        setTimeout(() => endRound(), 1000);
      }
    }
    
    setGuess('');
  };

  const startDrawing = (e) => {
    if (gameState !== 'playing' || !currentPrompt || isPaused) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (isPickingColor) {
      pickColorFromCanvas(x, y);
      return;
    }
    
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = brushSize * 2;
      ctx.fillStyle = 'rgba(0,0,0,1)'; // Doesn't matter for eraser
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.fillStyle = color; // Use selected color for dots
    }
    
    // Draw a dot for single clicks
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
    
    ctx.lineTo(x, y);
    ctx.stroke();
    setLastDrawPoint({ x, y });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastDrawPoint(null);
  };

  const handleMouseEnter = (e) => {
    if (!currentPrompt || isPaused || isPickingColor || !isDrawing) return;
    
    // Only continue drawing if button is still held AND we were already drawing
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
      
      // Start a new path at the re-entry point (no line connecting)
      ctx.beginPath();
      ctx.moveTo(x, y);
      
      setLastDrawPoint({ x, y });
      setIsDrawing(true);
    } else {
      // If button was released outside, stop drawing
      setIsDrawing(false);
      setLastDrawPoint(null);
    }
  };

  const pickColorFromCanvas = (x, y) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Round to nearest pixel to ensure we're getting a valid coordinate
    const pixelX = Math.round(x);
    const pixelY = Math.round(y);
    
    const imageData = ctx.getImageData(pixelX, pixelY, 1, 1);
    const [r, g, b, a] = imageData.data;
    
    // Only pick non-transparent pixels
    if (a > 0) {
      const hexColor = '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
      setColor(hexColor);
      setCustomColor(hexColor);
    }
    
    setTool('pen');
    setIsPickingColor(false);
  };

  const clearCanvas = () => {
    if (!currentPrompt || showClearDialog) return;
    setShowClearDialog(true);
  };

  const confirmClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
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

  if (gameState === 'setup') {
    const totalDrawings = maxRounds * players.length;
    const totalTime = totalDrawings * (90 + 30); // 90s drawing + 30s prompt picking per round
    const minutes = Math.floor(totalTime / 60);
    
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100'} p-8`}>
        <div className={`max-w-2xl mx-auto ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8`}>
          <div className="flex justify-between items-center mb-8">
            <h1 className={`text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent`}>
              Kinda Like Charades
            </h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
              title="Toggle dark mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
          
          <div className="mb-6">
            <label className={`block text-lg font-semibold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Select Category</label>
            <div className="grid grid-cols-2 gap-3">
              {categories.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    category === cat.value 
                      ? 'border-indigo-500 bg-indigo-50 shadow-md' 
                      : `${darkMode ? 'border-gray-600 bg-gray-700 hover:border-indigo-400' : 'border-gray-200 bg-white hover:border-indigo-300'}`
                  }`}
                >
                  <div className="text-3xl mb-1">{cat.emoji}</div>
                  <div className={`font-semibold ${darkMode && category !== cat.value ? 'text-gray-200' : 'text-gray-700'}`}>{cat.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className={`block text-lg font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Players</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Enter player name"
                maxLength={12}
                className={`flex-1 px-4 py-2 border-2 rounded-lg focus:border-indigo-400 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400' : 'border-gray-200 bg-white'}`}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    const newName = e.target.value.trim().replace(/[^a-zA-Z0-9]/g, '');
                    if (!newName) {
                      alert('Name must contain letters or numbers!');
                      return;
                    }
                    if (players.includes(newName)) {
                      alert('A player with this name already exists!');
                      return;
                    }
                    setPlayers([...players, newName]);
                    e.target.value = '';
                  }
                }}
                onChange={(e) => {
                  e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                }}
              />
              <button
                onClick={(e) => {
                  const input = e.target.previousSibling;
                  const newName = input.value.trim().replace(/[^a-zA-Z0-9]/g, '');
                  if (newName) {
                    if (!newName) {
                      alert('Name must contain letters or numbers!');
                      return;
                    }
                    if (players.includes(newName)) {
                      alert('A player with this name already exists!');
                      return;
                    }
                    setPlayers([...players, newName]);
                    input.value = '';
                  }
                }}
                className="px-6 py-2 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {players.map((p, i) => (
                <div key={i} className={`${darkMode ? 'bg-gray-700' : 'bg-gradient-to-r from-indigo-100 to-purple-100'} px-4 py-2 rounded-full flex items-center gap-2`}>
                  <span className={`font-medium ${darkMode ? 'text-gray-200' : ''}`}>{p}</span>
                  <button
                    onClick={() => setPlayers(players.filter((_, idx) => idx !== i))}
                    className="text-red-500 font-bold hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className={`block text-lg font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Rounds</label>
            <input
              type="number"
              min="1"
              max="5"
              value={maxRounds}
              onChange={(e) => setMaxRounds(parseInt(e.target.value))}
              className={`w-full px-4 py-2 border-2 rounded-lg focus:border-indigo-400 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'border-gray-200 bg-white'}`}
            />
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
              Total drawings: {totalDrawings} • Estimated time: ~{minutes} minutes
            </p>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hintsEnabled}
                onChange={(e) => setHintsEnabled(e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <div>
                <span className={`text-lg font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Enable Hints</span>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Reveals letters in the prompt every 15 seconds</p>
              </div>
            </label>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={saveWithTransparency}
                onChange={(e) => setSaveWithTransparency(e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <div>
                <span className={`text-lg font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Save drawings with transparency</span>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Saves drawings as PNG without white background</p>
              </div>
            </label>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={useCustomPrompts}
                onChange={(e) => setUseCustomPrompts(e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <div>
                <span className={`text-lg font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Use Custom Prompt Pack</span>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Upload a .txt file with your own prompts</p>
              </div>
            </label>
            {useCustomPrompts && (
              <div className="space-y-3">
                <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${darkMode ? 'border-gray-600 hover:border-indigo-400 bg-gray-700' : 'border-gray-300 hover:border-indigo-400'}`}>
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="promptFile"
                  />
                  <label htmlFor="promptFile" className="cursor-pointer">
                    <div className="text-4xl mb-2">📄</div>
                    <div className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      {customPrompts ? 'Prompt pack loaded! Click to change' : 'Click to upload prompt pack'}
                    </div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>Upload a .txt file</div>
                  </label>
                </div>
                
                <details className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4`}>
                  <summary className={`cursor-pointer font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} text-sm`}>
                    📝 How to format your prompt pack
                  </summary>
                  <div className={`mt-3 text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'} space-y-2`}>
                    <p className={`font-mono ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} p-3 rounded border whitespace-pre`}>
{`[Animals]
Easy:
elephant
butterfly
Medium:
octopus
peacock
Hard:
axolotl
platypus

[Food]
Easy:
pizza
burger
Medium:
sushi
tacos
Hard:
bouillabaisse
tiramisu`}
                    </p>
                    <p>• Categories: animals, food, places, objects, popculture, general</p>
                    <p>• General category will include ALL your custom prompts</p>
                    <p>• Custom prompts mix with AI-generated ones</p>
                  </div>
                </details>
              </div>
            )}
          </div>

          <button
            onClick={startGame}
            disabled={players.length < 2}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-bold text-xl hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'gameEnd') {
    const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100'} p-8`}>
        <div className={`max-w-4xl mx-auto ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8`}>
          <div className="flex justify-between items-center mb-8">
            <h1 className={`text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent`}>
              Game Complete!
            </h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
          
          <div className="mb-8">
            <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Final Scores</h2>
            {sortedScores.map(([player, score], i) => (
              <div key={player} className={`flex justify-between items-center p-4 mb-2 ${darkMode ? 'bg-gray-700' : 'bg-gradient-to-r from-indigo-50 to-purple-50'} rounded-lg`}>
                <span className={`text-xl font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  {i === 0 && '🏆 '}{player}
                </span>
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
                      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} capitalize`}>
                        by {drawing.drawer} • {drawing.difficulty}
                      </div>
                    </div>
                    <button
                      onClick={() => downloadDrawing(drawing)}
                      className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              setGameState('setup');
              // Keep players from previous game
              setDrawings([]);
              setUsedPrompts(new Set());
            }}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-bold text-xl hover:from-indigo-600 hover:to-purple-600 transition-all transform hover:scale-105"
          >
            New Game
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'roundEnd') {
    const wasSkipped = !currentPrompt;
    const isLastRound = round >= maxRounds * players.length;
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100'} flex items-center justify-center`}>
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-12 text-center max-w-2xl`}>
          {wasSkipped ? (
            <>
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                Time's Up!
              </h1>
              <p className={`text-2xl mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                {players[currentDrawer]} didn't pick a prompt in time
              </p>
              {!isLastRound && <p className={`text-md ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-4`}>Next round starting...</p>}
            </>
          ) : (
            <>
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Round Over!
              </h1>
              <p className={`text-2xl mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                The prompt was: <span className="font-bold text-indigo-600">{currentPrompt?.prompt}</span>
              </p>
              <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-4 capitalize`}>Difficulty: {currentPrompt?.difficulty}</p>
              {correctGuessers.length > 0 ? (
                <div className="text-lg text-green-600 font-semibold">
                  Correct guessers: {correctGuessers.join(', ')}
                </div>
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

  const drawerName = players[currentDrawer];

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100'} p-4`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-4 mb-4 flex justify-between items-center`}>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Kinda Like Charades
            </h1>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Round {round} of {maxRounds * players.length} • {categories.find(c => c.value === category)?.emoji} {categories.find(c => c.value === category)?.label}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                isPaused 
                  ? 'bg-gray-400 text-white cursor-default' 
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
              }`}
              disabled={isPaused}
            >
              {isPaused ? 'Paused' : '⏸ Pause'}
            </button>
            <div className="text-right">
              <div className="text-3xl font-bold text-indigo-600">{currentPrompt ? timeLeft : 90}s</div>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Drawer: {drawerName}</div>
            </div>
          </div>
        </div>

        {/* Pause Overlay */}
        {isPaused && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-12 text-center max-w-md">
              <h2 className="text-4xl font-bold mb-4 text-gray-800">⏸ Game Paused</h2>
              <p className="text-lg text-gray-600 mb-6">Click Resume to continue playing</p>
              <button
                onClick={() => setIsPaused(false)}
                className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-xl transition-colors"
              >
                ▶ Resume Game
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 h-[calc(100vh-12rem)]">
          {/* Drawing Area - Left side, takes up 2 columns */}
          <div className="col-span-2 flex flex-col h-full">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-4 flex-1 flex flex-col`}>
              {!currentPrompt ? (
                <div className={`mb-4 p-6 ${darkMode ? 'bg-gray-700' : 'bg-gradient-to-r from-indigo-50 to-purple-50'} rounded-lg flex-shrink-0`}>
                  <div className="flex justify-between items-center mb-4">
                    <p className={`text-xl font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Choose your prompt:
                    </p>
                    {!generatingPrompts && promptOptions.length > 0 && (
                      <div>
                        <div className="text-2xl font-bold text-red-500">{promptSelectionTime}s</div>
                        <div className="text-xs text-gray-500 text-right">before skip</div>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {(promptOptions.length > 0 ? promptOptions : [{prompt: '', difficulty: 'easy'}, {prompt: '', difficulty: 'medium'}, {prompt: '', difficulty: 'hard'}]).map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => !generatingPrompts && opt.prompt && selectPrompt(opt)}
                        disabled={generatingPrompts || !opt.prompt}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          generatingPrompts || !opt.prompt
                            ? 'bg-gray-100 border-gray-200 cursor-wait'
                            : opt.difficulty === 'easy' ? 'bg-green-50 border-green-200 hover:border-indigo-500' :
                              opt.difficulty === 'medium' ? 'bg-yellow-50 border-yellow-200 hover:border-indigo-500' :
                              'bg-red-50 border-red-200 hover:border-indigo-500'
                        }`}
                      >
                        {generatingPrompts || !opt.prompt ? (
                          <div className="flex items-center justify-center h-12">
                            <div className="flex gap-1 text-2xl font-bold">
                              <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                              <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                              <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="font-semibold text-gray-800">{opt.prompt}</div>
                            <div className={`text-xs mt-1 capitalize ${
                              opt.difficulty === 'easy' ? 'text-green-600' :
                              opt.difficulty === 'medium' ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {opt.difficulty} • {opt.difficulty === 'easy' ? '100' : opt.difficulty === 'medium' ? '200' : '300'} pts
                            </div>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={generatePrompts}
                    disabled={generatingPrompts}
                    className={`w-full py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                      generatingPrompts
                        ? 'bg-gray-300 text-gray-500 cursor-wait'
                        : darkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {generatingPrompts ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex gap-1 text-lg font-bold">
                          <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                          <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                          <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                        </span>
                        <span>Generating prompts...</span>
                      </div>
                    ) : (
                      <>
                        <RefreshCw size={16} /> Get new prompts
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div>
                  <div className={`mb-4 p-4 ${darkMode ? 'bg-gray-700' : 'bg-gradient-to-r from-indigo-50 to-purple-50'} rounded-lg flex-shrink-0`}>
                    <p className={`text-center text-xl font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'} mb-2`}>
                      Draw: {currentPrompt.prompt}
                    </p>
                    <p className={`text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} capitalize`}>
                      {currentPrompt.difficulty} difficulty
                    </p>
                  </div>

                  {/* Letter spaces hint */}
                  <div className="mb-4 flex justify-center gap-1 flex-wrap flex-shrink-0 min-h-[52px] items-center">
                    {currentPrompt.prompt.split('').map((char, i) => (
                      <div
                        key={i}
                        className={`
                          ${char === ' ' ? 'w-4' : `w-8 h-10 border-2 ${darkMode ? 'border-gray-600' : 'border-gray-300'} rounded flex items-center justify-center font-bold text-xl`}
                          ${revealedLetters.includes(i) ? 'bg-yellow-100 text-gray-800' : `${darkMode ? 'bg-gray-700 text-transparent' : 'bg-white text-transparent'}`}
                        `}
                      >
                        {char === ' ' ? '' : revealedLetters.includes(i) ? char : '_'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tools */}
              <div className={`flex gap-2 mb-4 flex-wrap items-center flex-shrink-0 ${!currentPrompt ? 'pointer-events-none opacity-30' : ''}`}>
                <button
                  onClick={() => { setTool('pen'); setIsPickingColor(false); }}
                  className={`p-2 rounded transition-colors ${tool === 'pen' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                  title="Pen"
                >
                  <Pencil size={20} />
                </button>
                <button
                  onClick={() => { setTool('eraser'); setIsPickingColor(false); }}
                  className={`p-2 rounded transition-colors ${tool === 'eraser' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                  title="Eraser"
                >
                  <Eraser size={20} />
                </button>
                <button
                  onClick={() => setIsPickingColor(!isPickingColor)}
                  className={`p-2 rounded transition-colors ${isPickingColor ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                  title="Color Picker (Eyedropper)"
                >
                  <Pipette size={20} />
                </button>
                <button
                  onClick={clearCanvas}
                  className="p-2 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                  title="Clear Canvas"
                >
                  <Trash2 size={20} />
                </button>
                
                <div className="h-8 w-px bg-gray-300 mx-1"></div>
                
                <div className="flex gap-1 flex-wrap">
                  {baseColors.map(c => (
                    <button
                      key={c}
                      onClick={() => { setColor(c); setTool('pen'); setIsPickingColor(false); }}
                      className={`w-7 h-7 rounded border-2 transition-all hover:scale-110 ${color === c ? 'border-indigo-500 shadow-md' : 'border-gray-300'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                
                <button
                  onClick={() => document.getElementById('colorPicker').click()}
                  className="relative w-10 h-8 rounded border-2 border-gray-300 hover:border-indigo-400 transition-all overflow-hidden"
                  title="Custom Color Picker"
                >
                  <div className="absolute inset-0 flex items-center justify-center bg-white">
                    <Palette size={18} className="text-gray-600" />
                  </div>
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-2" 
                    style={{ backgroundColor: customColor }}
                  />
                </button>
                <input
                  id="colorPicker"
                  type="color"
                  value={customColor}
                  onChange={(e) => { setColor(e.target.value); setCustomColor(e.target.value); setTool('pen'); setIsPickingColor(false); }}
                  className="hidden"
                />
                
                <div className="h-8 w-px bg-gray-300 mx-1"></div>
                
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="flex-1 min-w-[100px]"
                />
                <span className="text-sm text-gray-600 font-medium min-w-[60px]">Size: {brushSize}</span>
              </div>

              <div className="overflow-auto relative flex-1 flex items-center justify-center">
                {/* Clear Canvas Dialog */}
                {showClearDialog && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 rounded-lg">
                    <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-2xl p-8 text-center max-w-sm`}>
                      <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        Clear canvas?
                      </h3>
                      <p className={`mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        This cannot be undone.
                      </p>
                      <div className="flex gap-4 justify-center">
                        <button
                          onClick={confirmClearCanvas}
                          className="px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors flex items-center gap-2"
                        >
                          ✓ Clear
                        </button>
                        <button
                          onClick={() => setShowClearDialog(false)}
                          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                        >
                          ✗ Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Pen preview cursor */}
                <style>{`
                  .canvas-cursor {
                    cursor: none !important;
                  }
                `}</style>
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className={`border-4 ${darkMode ? 'border-gray-600' : 'border-indigo-200'} bg-white rounded-lg ${isPickingColor ? 'cursor-crosshair' : 'canvas-cursor'} ${!currentPrompt ? 'pointer-events-none opacity-30' : ''}`}
                  style={{ maxWidth: '100%', height: 'auto' }}
                  onMouseDown={startDrawing}
                  onMouseMove={(e) => {
                    draw(e);
                    // Update cursor preview position and size
                    const preview = document.getElementById('pen-preview');
                    const canvas = canvasRef.current;
                    if (preview && !isPickingColor && currentPrompt && canvas) {
                      const rect = canvas.getBoundingClientRect();
                      const scaleX = rect.width / canvas.width;
                      const scaleY = rect.height / canvas.height;
                      
                      preview.style.left = `${e.clientX - rect.left}px`;
                      preview.style.top = `${e.clientY - rect.top}px`;
                      preview.style.width = `${brushSize * (tool === 'eraser' ? 2 : 1) * scaleX}px`;
                      preview.style.height = `${brushSize * (tool === 'eraser' ? 2 : 1) * scaleY}px`;
                      preview.style.backgroundColor = tool === 'eraser' ? 'rgba(255, 255, 255, 0.7)' : color + '80';
                      preview.style.display = 'block';
                    }
                  }}
                  onMouseUp={stopDrawing}
                  onMouseLeave={(e) => {
                    const preview = document.getElementById('pen-preview');
                    if (preview) preview.style.display = 'none';
                  }}
                  onMouseEnter={(e) => {
                    handleMouseEnter(e);
                    const preview = document.getElementById('pen-preview');
                    if (preview && !isPickingColor && currentPrompt) {
                      preview.style.display = 'block';
                    }
                  }}
                />
                {/* Pen size preview circle */}
                <div
                  id="pen-preview"
                  style={{
                    position: 'absolute',
                    pointerEvents: 'none',
                    borderRadius: '50%',
                    border: '1px solid rgba(0, 0, 0, 0.5)',
                    transform: 'translate(-50%, -50%)',
                    display: 'none',
                    zIndex: 1000
                  }}
                />
              </div>
            </div>
          </div>

          {/* Sidebar - Right side, takes up 1 column */}
          <div className="col-span-1 flex flex-col h-full">
            {/* Scores - 40% of height */}
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

            {/* Guessing - 60% of height */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-4 flex flex-col mt-4`} style={{ height: 'calc(60% - 1rem)' }}>
              <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-700'} flex-shrink-0`}>Guesses</h2>
              <div className={`mb-3 overflow-y-auto flex-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-3 space-y-2`}>
                {guesses.map((g, i) => (
                  <div key={i} className={`text-sm p-2 rounded ${
                    g.correct ? 'bg-green-100 text-green-800 font-bold' : 
                    g.oneOff ? 'bg-yellow-100 text-yellow-800' :
                    'bg-white text-gray-700'
                  }`}>
                    <span className="font-semibold">{g.player}:</span> {g.text}
                    {g.correct && (
                      <span className="ml-2">
                        ✓ {correctGuessers.indexOf(g.player) === 0 && '🥇'}
                      </span>
                    )}
                    {g.oneOff && (
                      <span className="ml-2 text-xs">
                        (so close! one letter off)
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <input
                  type="text"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && submitGuess()}
                  placeholder="Type your guess..."
                  className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-400 focus:outline-none"
                />
                <button
                  onClick={submitGuess}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SketchHeadsGame;