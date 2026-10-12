import React, { useState, useRef, useEffect, useCallback } from 'react';
import SketchHeadsGame from './SketchHeadsGame.jsx';

    // Firebase config
    const firebaseConfig = {
      apiKey: "AIzaSyAPSE2wneubHrTrCCsDn8ZEHyoszchOia0",
      authDomain: "laganea-drawing-game.firebaseapp.com",
      databaseURL: "https://laganea-drawing-game-default-rtdb.firebaseio.com",
      projectId: "laganea-drawing-game",
      storageBucket: "laganea-drawing-game.firebasestorage.app",
      messagingSenderId: "975169860070",
      appId: "1:975169860070:web:a3df9d3ffb85d4f1faa627"
    };

    // Firebase state
    let firebaseReady = false;
    let db = null;
    let auth = null;

    const initFirebase = async () => {
      if (firebaseReady) return;
      
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const { getDatabase } = await import('firebase/database');
      const { getAuth, signInAnonymously } = await import('firebase/auth');

      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      db = getDatabase(app);
      auth = getAuth(app);
      
      await signInAnonymously(auth);
      firebaseReady = true;
    };

    function generateRoomCode() {
      return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Main component
    const LAGANEA = () => {
      const [screen, setScreen] = useState('login');
      const [roomCode, setRoomCode] = useState('');
      const [playerName, setPlayerName] = useState('');
      const [joinCode, setJoinCode] = useState('');
      const [isHost, setIsHost] = useState(false);
      const [darkMode, setDarkMode] = useState(false);
      const [players, setPlayers] = useState([]);
      const [maxRounds, setMaxRounds] = useState(3);
      const [drawingTime, setDrawingTime] = useState(90);
      const [category, setCategory] = useState('general');
      const [gameState, setGameState] = useState('setup');
      const [syncStatus, setSyncStatus] = useState('');

      const categories = [
        { value: 'general', label: 'General', emoji: '🎲' },
        { value: 'animals', label: 'Animals', emoji: '🐾' },
        { value: 'food', label: 'Food & Drink', emoji: '🍕' },
        { value: 'places', label: 'Places', emoji: '🗺️' },
        { value: 'objects', label: 'Objects', emoji: '📦' },
        { value: 'popculture', label: 'Pop Culture', emoji: '🎬' }
      ];

      useEffect(() => {
        initFirebase().catch((e) => setSyncStatus('✗ Firebase unavailable: ' + e.message));
      }, []);

      const createRoom = async () => {
        if (!playerName.trim()) return;
        try { await initFirebase(); } catch (e) { setSyncStatus('✗ Firebase unavailable: ' + e.message); return; }
        const code = generateRoomCode();
        setRoomCode(code);
        setIsHost(true);
        setPlayers([playerName]);
        setSyncStatus('Creating room...');
        
        const { ref, set } = await import('firebase/database');
        try {
          const playerId = auth.currentUser.uid;
          await set(ref(db, `rooms/${code}`), {
            host: playerId,
            players: { [playerId]: { name: playerName.trim(), joinedAt: Date.now() } },
            gameState: 'setup',
            maxRounds: 3,
            drawingTime: 90,
            hintsEnabled: true,
            hintFraction: 0.5,
            category: 'general',
          });
          setSyncStatus('✓ Room created');
          setScreen('setup');
        } catch (e) {
          setSyncStatus('✗ Error: ' + e.message);
          console.error('Error creating room:', e);
        }
      };

      const joinRoom = async () => {
        if (!playerName.trim() || !joinCode.trim()) return;
        try { await initFirebase(); } catch (e) { setSyncStatus('✗ Firebase unavailable: ' + e.message); return; }
        try { await initFirebase(); } catch (e) { setSyncStatus('✗ Firebase unavailable: ' + e.message); return; }
        const code = joinCode.toUpperCase();
        setRoomCode(code);
        setIsHost(false);
        setSyncStatus('Joining room...');
        
        const { ref, update, get } = await import('firebase/database');
        try {
          // First check if room exists
          const roomRef = ref(db, `rooms/${code}`);
          const snapshot = await get(roomRef);
          if (!snapshot.exists()) {
            setSyncStatus('✗ Room not found');
            return;
          }

          // Add player to players list
          if (snapshot.val().gameState !== 'setup') {
            setSyncStatus('✗ This room has already started');
            return;
          }
          const playerId = auth.currentUser.uid;
          await update(ref(db, `rooms/${code}/players`), {
            [playerId]: { name: playerName.trim(), joinedAt: Date.now() }
          });

          // Get current players
          const playersSnapshot = await get(ref(db, `rooms/${code}/players`));
          if (playersSnapshot.exists()) {
            setPlayers(Object.values(playersSnapshot.val()).map((p) => typeof p === 'string' ? p : p.name));
          }
          
          setSyncStatus('✓ Joined room');
          setScreen('setup');
        } catch (e) {
          setSyncStatus('✗ Error: ' + e.message);
          console.error('Error joining room:', e);
        }
      };

      const startGame = async () => {
        if (!isHost || players.length < 2 || !roomCode) return;
        try {
          await initFirebase();
          const { ref, update } = await import('firebase/database');
          const wordLists = {
            general: ['rainbow', 'rocket', 'castle', 'guitar', 'snowman', 'umbrella', 'bicycle', 'robot'],
            animals: ['elephant', 'penguin', 'giraffe', 'octopus', 'butterfly', 'turtle'],
            food: ['pizza', 'hamburger', 'watermelon', 'taco', 'ice cream', 'pancakes'],
            places: ['beach', 'school', 'airport', 'library', 'mountain', 'museum'],
            objects: ['scissors', 'backpack', 'lantern', 'camera', 'clock', 'telescope'],
            popculture: ['superhero', 'alien', 'pirate', 'wizard', 'dinosaur', 'dragon']
          };
          const { get } = await import('firebase/database');
          const snap = await get(ref(db, `rooms/${roomCode}/players`));
          const playerIds = snap.exists() ? Object.keys(snap.val()) : [];
          const scores = Object.fromEntries(playerIds.map(id => [id, 0]));
          await update(ref(db, `rooms/${roomCode}`), {
            gameState: 'playing', round: 1, turnIndex: 0, prompt: null,
            deadline: Date.now() + 30000, scores, guesses: null, correctGuessers: null, drawingImage: null
          });
          setGameState('playing');
          setSyncStatus('✓ Game started');
        } catch (e) {
          setSyncStatus('✗ Could not start game: ' + e.message);
        }
      };

      const leaveRoom = () => {
        setScreen('login');
        setRoomCode('');
        setPlayerName('');
        setPlayers([]);
        setIsHost(false);
        setGameState('setup');
        setSyncStatus('');
      };

      useEffect(() => {
        if (screen !== 'setup' || !roomCode) return;
        let unsubscribe;
        let active = true;
        import('firebase/database').then(({ ref, onValue }) => {
          if (!active) return;
          unsubscribe = onValue(ref(db, `rooms/${roomCode}`), (snapshot) => {
            if (!snapshot.exists()) {
              setSyncStatus('✗ Room no longer exists');
              return;
            }
            const data = snapshot.val();
            const roomPlayers = data.players ? Object.values(data.players) : [];
            setPlayers(roomPlayers.map((p) => typeof p === 'string' ? p : p.name));
            setMaxRounds(data.maxRounds || 3);
            setDrawingTime(data.drawingTime || 90);
            setCategory(data.category || 'general');
            if (data.gameState && data.gameState !== 'setup') setGameState(data.gameState);
          }, (error) => setSyncStatus('✗ Room sync error: ' + error.message));
        }).catch((e) => setSyncStatus('✗ Room sync error: ' + e.message));
        return () => { active = false; if (unsubscribe) unsubscribe(); };
      }, [screen, roomCode]);

      const saveRoomSetting = async (key, value) => {
        if (!isHost || !roomCode) return;
        try {
          await initFirebase();
          const { ref, update } = await import('firebase/database');
          await update(ref(db, `rooms/${roomCode}`), { [key]: value });
          setSyncStatus('✓ Room settings saved');
        } catch (e) {
          setSyncStatus('✗ Could not save settings: ' + e.message);
        }
      };

      // Login screen
      if (screen === 'login') {
        return (
          <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100'} p-8 flex items-center justify-center`}>
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-12 w-full max-w-md`}>
              <div className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">LAGANEA</h1>
                <button onClick={() => setDarkMode(!darkMode)} className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'} transition-colors`}>
                  {darkMode ? '☀️' : '🌙'}
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Your name</label>
                  <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && createRoom()}
                    placeholder="Enter your name"
                    className={`w-full px-4 py-2 border-2 rounded-lg focus:border-indigo-400 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'border-gray-200 bg-white'}`} />
                </div>

                <button onClick={createRoom} disabled={!playerName.trim()}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-bold hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  Create Room
                </button>

                <div className={`text-center py-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>or</div>

                <div>
                  <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Room code</label>
                  <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
                    placeholder="Enter code (e.g. ABC123)"
                    maxLength="6"
                    className={`w-full px-4 py-2 border-2 rounded-lg focus:border-indigo-400 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'border-gray-200 bg-white'}`} />
                </div>

                <button onClick={joinRoom} disabled={!playerName.trim() || !joinCode.trim()}
                  className="w-full py-3 bg-indigo-500 text-white rounded-lg font-bold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  Join Room
                </button>
              </div>

              {syncStatus && (
                <div className={`text-sm text-center p-2 rounded ${syncStatus.startsWith('✓') ? darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800' : darkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-800'}`}>
                  {syncStatus}
                </div>
              )}
            </div>
          </div>
        );
      }

      // Render the actual game once Firebase reports that the host has started it.
      if (screen === 'setup' && gameState !== 'setup') {
        return <SketchHeadsGame roomCode={roomCode} playerName={playerName} isHost={isHost} initialDarkMode={darkMode} onLeave={leaveRoom} />;
      }

      // Setup screen
      if (screen === 'setup') {
        return (
          <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100'} p-8`}>
            <div className={`max-w-2xl mx-auto ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8`}>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">LAGANEA</h1>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Room: <span className="font-mono font-bold">{roomCode}</span></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => navigator.clipboard.writeText(roomCode)} 
                    className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`} title="Copy room code">
                    📋
                  </button>
                  <button onClick={leaveRoom} className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`} title="Leave room">
                    🚪
                  </button>
                  <button onClick={() => setDarkMode(!darkMode)} className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'} transition-colors`}>
                    {darkMode ? '☀️' : '🌙'}
                  </button>
                </div>
              </div>

              <div className={`mb-6 p-4 ${darkMode ? 'bg-gray-700' : 'bg-indigo-50'} rounded-lg`}>
                <h2 className={`font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Players in room:</h2>
                <div className="flex flex-wrap gap-2">
                  {players.map((p, i) => (
                    <div key={i} className={`px-3 py-1 rounded-full text-sm ${darkMode ? 'bg-gray-600 text-gray-100' : 'bg-indigo-200 text-indigo-900'}`}>
                      {p} {isHost && players[0] === p && '👑'}
                    </div>
                  ))}
                </div>
              </div>

              {isHost && (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Category</label>
                    <div className="grid grid-cols-3 gap-2">
                      {categories.map(cat => (
                        <button key={cat.value} onClick={() => { setCategory(cat.value); saveRoomSetting('category', cat.value); }}
                          className={`p-2 rounded-lg border-2 text-center transition-all ${category === cat.value ? 'border-indigo-500 bg-indigo-50' : `${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200'}`}`}>
                          <div className="text-2xl">{cat.emoji}</div>
                          <div className={`text-xs font-semibold ${darkMode && category !== cat.value ? 'text-gray-300' : 'text-gray-700'}`}>{cat.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Rounds: {maxRounds}</label>
                    <input type="range" min="1" max="5" value={maxRounds} onChange={(e) => { const value = parseInt(e.target.value, 10); setMaxRounds(value); saveRoomSetting('maxRounds', value); }} className="w-full" />
                  </div>

                  <div>
                    <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Drawing Time: {drawingTime}s</label>
                    <input type="range" min="30" max="120" step="15" value={drawingTime} onChange={(e) => { const value = parseInt(e.target.value, 10); setDrawingTime(value); saveRoomSetting('drawingTime', value); }} className="w-full" />
                  </div>
                </div>
              )}

              <button onClick={startGame} disabled={players.length < 2 || !isHost}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-bold hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {isHost ? 'Start Game' : 'Waiting for host...'}
              </button>

              {syncStatus && (
                <div className={`text-xs text-center p-2 rounded mt-4 ${syncStatus.startsWith('✓') ? darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800' : darkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-800'}`}>
                  {syncStatus}
                </div>
              )}
            </div>
          </div>
        );
      }

      // Playing screen (placeholder)
      if (screen === 'playing') {
        return (
          <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100'} p-4`}>
            <div className={`max-w-7xl mx-auto ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-4`}>
              <h1 className="text-2xl font-bold text-indigo-600 mb-4">🎮 Multiplayer Game</h1>
              <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>✓ Room: {roomCode}</p>
              <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>✓ Players: {players.join(', ')}</p>
              <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>✓ You are: {isHost ? 'HOST 👑' : 'GUEST'}</p>
              <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Category: {categories.find(c => c.value === category)?.label}</p>
              
              <button onClick={() => setScreen('setup')} className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600">
                Back to Setup
              </button>
            </div>
          </div>
        );
      }

      return null;
    };

    export default LAGANEA;