import React, { useState, useRef, useEffect, useCallback } from 'react';
import SketchHeadsGame from './SketchHeadsGame.jsx';
import LaganeaLogo from './LaganeaLogo.jsx';

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
      const [darkMode, setDarkMode] = useState(true);
      const [players, setPlayers] = useState([]);
      const [playerEntries, setPlayerEntries] = useState([]);
      const [allowJoinInProgress, setAllowJoinInProgress] = useState(true);
      const [stayInLobby, setStayInLobby] = useState(false);
      const [maxRounds, setMaxRounds] = useState(3);
      const [drawingTime, setDrawingTime] = useState(90);
      const [category, setCategory] = useState('general');
      const [gameState, setGameState] = useState('setup');
      const [syncStatus, setSyncStatus] = useState('');
      const [showLobbySettings, setShowLobbySettings] = useState(false);
      const [hintsEnabled, setHintsEnabled] = useState(true);
      const [hintFraction, setHintFraction] = useState(0.5);

      const categories = [
        { value: 'general', label: 'General', emoji: '🎲' },
        { value: 'animals', label: 'Animals', emoji: '🐾' },
        { value: 'food', label: 'Food & Drink', emoji: '🍕' },
        { value: 'places', label: 'Places', emoji: '🗺️' },
        { value: 'objects', label: 'Objects', emoji: '📦' },
        { value: 'popculture', label: 'Pop Culture', emoji: '🎬' }
      ];

      useEffect(() => {
        let active = true;
        (async () => {
          try {
            await initFirebase();
            const { ref, get } = await import('firebase/database');
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            const snapshot = await get(ref(db, `userPreferences/${uid}`));
            if (!active) return;
            if (snapshot.exists()) {
              const prefs = snapshot.val();
              if (typeof prefs.playerName === 'string') setPlayerName(prefs.playerName);
              if (typeof prefs.darkMode === 'boolean') setDarkMode(prefs.darkMode);
              const settings = prefs.settings || {};
              if (Number.isFinite(settings.maxRounds)) setMaxRounds(settings.maxRounds);
              if (Number.isFinite(settings.drawingTime)) setDrawingTime(settings.drawingTime);
              if (typeof settings.category === 'string') setCategory(settings.category);
              if (typeof settings.hintsEnabled === 'boolean') setHintsEnabled(settings.hintsEnabled);
              if (Number.isFinite(settings.hintFraction)) setHintFraction(settings.hintFraction);
              if (typeof settings.allowJoinInProgress === 'boolean') setAllowJoinInProgress(settings.allowJoinInProgress);
            }
          } catch (e) {
            setSyncStatus('⚠ Saved preferences unavailable; check Firebase database rules.');
          }
        })();
        return () => { active = false; };
      }, []);

      const saveUserPreference = async (key, value) => {
        try {
          await initFirebase();
          const { ref, update } = await import('firebase/database');
          const uid = auth.currentUser?.uid;
          if (uid) await update(ref(db, `userPreferences/${uid}`), { [key]: value });
        } catch (e) {
          setSyncStatus('⚠ Preference not saved; check Firebase database rules.');
        }
      };
      const saveUserSetting = (key, value) => saveUserPreference(`settings/${key}`, value);
      const handleDarkModeChange = useCallback((value) => { setDarkMode(value); saveUserPreference('darkMode', value); }, []);

      const createRoom = async () => {
        if (!playerName.trim()) return;
        try { await initFirebase(); } catch (e) { setSyncStatus('✗ Firebase unavailable: ' + e.message); return; }
        await saveUserPreference('playerName', playerName.trim());
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
            allowJoinInProgress: true,
            maxRounds,
            drawingTime,
            hintsEnabled,
            hintFraction,
            category,
          });
          setSyncStatus('✓ Room created');
          setScreen('lobby');
        } catch (e) {
          setSyncStatus('✗ Error: ' + e.message);
          console.error('Error creating room:', e);
        }
      };

      const joinRoom = async () => {
        if (!playerName.trim() || !joinCode.trim()) return;
        try { await initFirebase(); } catch (e) { setSyncStatus('✗ Firebase unavailable: ' + e.message); return; }
        await saveUserPreference('playerName', playerName.trim());
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
          const roomData = snapshot.val();
          if (roomData.gameState !== 'setup' && !(roomData.gameState === 'playing' && roomData.allowJoinInProgress !== false)) {
            setSyncStatus('✗ This room is not accepting new players right now');
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
          setScreen(roomData.gameState === 'playing' ? 'playing' : 'lobby');
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
            deadline: Date.now() + 30000, scores, guesses: null, correctGuessers: null, drawingImage: null, drawingHistory: null, paused: false
          });
          setGameState('playing');
          setSyncStatus('✓ Game started');
        } catch (e) {
          setSyncStatus('✗ Could not start game: ' + e.message);
        }
      };

      const returnToLobby = (stay = false) => {
        setStayInLobby(stay);
        setScreen('lobby');
      };

      const leaveRoom = () => {
        setStayInLobby(false);
        setScreen('login');
        setRoomCode('');
        setPlayerName('');
        setPlayers([]);
        setIsHost(false);
        setGameState('setup');
        setSyncStatus('');
      };

      useEffect(() => {
        if (screen !== 'lobby' || !roomCode) return;
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
            setPlayerEntries(Object.entries(data.players || {}).map(([id,p]) => ({ id, name: typeof p === 'string' ? p : p.name || 'Player' })));
            setAllowJoinInProgress(data.allowJoinInProgress !== false);
            setMaxRounds(data.maxRounds || 3);
            setDrawingTime(data.drawingTime || 90);
            setCategory(data.category || 'general');
            setHintsEnabled(data.hintsEnabled !== false);
            setHintFraction(Number(data.hintFraction) || 0.5);
            setGameState(data.gameState || 'setup');
            if (data.gameState === 'playing' && !stayInLobby) setScreen('playing');
            else if (data.gameState === 'setup') setScreen('lobby');
            const playerId = auth.currentUser?.uid;
            if (playerId && data.players && !data.players[playerId]) { setSyncStatus('You were removed from this room.'); leaveRoom(); }
          }, (error) => setSyncStatus('✗ Room sync error: ' + error.message));
        }).catch((e) => setSyncStatus('✗ Room sync error: ' + e.message));
        return () => { active = false; if (unsubscribe) unsubscribe(); };
      }, [screen, roomCode, stayInLobby]);

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
          <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100'} p-8 flex items-center justify-center`} style={{ minHeight: '100dvh', backgroundAttachment: 'fixed', backgroundSize: 'cover' }}>
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-12 w-full max-w-md`}>
              <div className="flex justify-between items-center mb-8">
                <div className="flex-1 flex justify-center"><LaganeaLogo width={245} /></div>
                <button onClick={() => { const next = !darkMode; setDarkMode(next); saveUserPreference('darkMode', next); }} className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'} transition-colors`}>
                  {darkMode ? '☀️' : '🌙'}
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Your name</label>
                  <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} onBlur={() => saveUserPreference('playerName', playerName.trim())}
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

      // Always use the preserved original JSX game for active multiplayer rooms.
      // The legacy screen === 'playing' branch below is only a placeholder and must not render.
      if (screen === 'playing') {
        return <SketchHeadsGame roomCode={roomCode} playerName={playerName} isHost={isHost} initialDarkMode={darkMode} onDarkModeChange={handleDarkModeChange} onLeave={leaveRoom} onReturnToLobby={returnToLobby} />;
      }

      // Setup screen
      if (screen === 'lobby') {
        return (
          <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100'} p-8`} style={{ minHeight: '100dvh', backgroundAttachment: 'fixed', backgroundSize: 'cover' }}>
            <div className={`max-w-2xl mx-auto ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8`}>
              <div className="relative flex items-start justify-between gap-3 mb-8">
                <div className="flex flex-col items-start text-left pt-1">
                  <LaganeaLogo width={210} />
                  <div className={`mt-3 inline-flex items-center gap-3 rounded-xl px-4 py-2 ${darkMode ? 'bg-gray-700 text-gray-100' : 'bg-indigo-50 text-gray-800'}`}>
                    <span className="text-sm">Room code</span><span className="font-mono text-xl font-black tracking-widest">{roomCode}</span>
                    <button onClick={() => { navigator.clipboard.writeText(roomCode); setSyncStatus('✓ Room code copied'); }} className={`px-2 py-1 rounded ${darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-white hover:bg-indigo-100'}`} title="Copy room code" aria-label="Copy room code">📋</button>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setShowLobbySettings(true)} className="px-3 py-2 rounded-lg bg-indigo-100 hover:bg-indigo-200" title="Game settings">⚙️</button>
                  <button onClick={leaveRoom} className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`} title="Leave room">
                    🚪
                  </button>
                  <button onClick={() => { const next = !darkMode; setDarkMode(next); saveUserPreference('darkMode', next); }} className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'} transition-colors`}>
                    {darkMode ? '☀️' : '🌙'}
                  </button>
                </div>
              </div>

              <div className={`mb-6 p-4 ${darkMode ? 'bg-gray-700' : 'bg-indigo-50'} rounded-lg`}>
                <h2 className={`font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Players in room:</h2>
                <div className="flex flex-wrap gap-2">
                  {playerEntries.map((p) => (
                    <div key={p.id} className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${darkMode ? 'bg-gray-600 text-gray-100' : 'bg-indigo-200 text-indigo-900'}`}>
                      <span>{p.name} {isHost && p.id === auth.currentUser?.uid && '👑'}</span>
                      {isHost && p.id !== auth.currentUser?.uid && <button onClick={async () => { const { ref, update } = await import('firebase/database'); const patch = { [`players/${p.id}`]: null, [`scores/${p.id}`]: null }; await update(ref(db, `rooms/${roomCode}`), patch); }} className="text-red-600 hover:text-red-800 font-black leading-none" title={`Kick ${p.name}`} aria-label={`Kick ${p.name}`}>✕</button>}
                    </div>
                  ))}
                </div>
              </div>

              {gameState === 'playing' && <button onClick={() => { setStayInLobby(false); setScreen('playing'); }} className="w-full mb-3 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold">Return to game</button>}
              <button onClick={startGame} disabled={players.length < 2 || !isHost || gameState === 'playing'}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-bold hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {isHost ? 'Start Game' : 'Waiting for host...'}
              </button>

              {syncStatus && (
                <div className={`text-xs text-center p-2 rounded mt-4 ${syncStatus.startsWith('✓') ? darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800' : darkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-800'}`}>
                  {syncStatus}
                </div>
              )}
            </div>
            {showLobbySettings && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowLobbySettings(false)}>
                  <div className={`w-full max-w-md rounded-2xl shadow-2xl ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`} onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-6 border-b"><h2 className="text-2xl font-bold">Game Settings</h2><button onClick={() => setShowLobbySettings(false)}>✕</button></div>
                    <div className="p-6 space-y-6">
                      <div><label className="block font-semibold mb-2">Category</label><div className="grid grid-cols-3 gap-2">{categories.map(cat => <button key={cat.value} disabled={!isHost} onClick={() => { setCategory(cat.value); saveRoomSetting('category',cat.value); saveUserSetting('category',cat.value); }} className={`p-2 rounded-lg border-2 text-center ${category===cat.value?'border-indigo-500 bg-indigo-500/20':(darkMode?'border-gray-600':'border-gray-200')}`}><div className="text-xl">{cat.emoji}</div><div className="text-xs font-semibold">{cat.label}</div></button>)}</div></div>
                      <div><label className="block font-semibold mb-2">Rounds: {maxRounds}</label><input type="range" min="1" max="5" value={maxRounds} disabled={!isHost} onChange={(e) => { const v=Number(e.target.value); setMaxRounds(v); saveRoomSetting('maxRounds',v); saveUserSetting('maxRounds',v); }} className="w-full" /></div>
                      <div><label className="block font-semibold mb-2">Drawing time: {drawingTime}s</label><input type="range" min="30" max="120" step="15" value={drawingTime} disabled={!isHost} onChange={(e) => { const v=Number(e.target.value); setDrawingTime(v); saveRoomSetting('drawingTime',v); saveUserSetting('drawingTime',v); }} className="w-full" /></div>
                      <div className={`flex items-center justify-between gap-4 rounded-lg p-3 ${darkMode?'bg-gray-700':'bg-indigo-50'}`}><div><div className="font-semibold">Allow joining in progress</div><div className="text-xs opacity-70">Let new players join after the game starts.</div></div><button disabled={!isHost} onClick={() => { const v=!allowJoinInProgress; setAllowJoinInProgress(v); saveRoomSetting('allowJoinInProgress',v); saveUserSetting('allowJoinInProgress',v); }} role="switch" aria-checked={allowJoinInProgress} className={`w-12 h-7 rounded-full p-1 ${allowJoinInProgress?'bg-indigo-500':'bg-gray-400'} disabled:opacity-50`}><span className={`block w-5 h-5 rounded-full bg-white transition-transform ${allowJoinInProgress?'translate-x-5':''}`} /></button></div>
                      <div><label className="block font-semibold mb-2">Hints</label><div className="flex gap-2">{[{label:'None',value:0},{label:'Few',value:0.25},{label:'Some',value:0.5},{label:'Lots',value:0.75}].map(opt => <button key={opt.label} disabled={!isHost} onClick={() => { const enabled=opt.value>0; setHintsEnabled(enabled); setHintFraction(opt.value||0.5); saveRoomSetting('hintsEnabled',enabled); saveRoomSetting('hintFraction',opt.value||0.5); saveUserSetting('hintsEnabled',enabled); saveUserSetting('hintFraction',opt.value||0.5); }} className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold ${(opt.value===0?!hintsEnabled:(hintsEnabled&&hintFraction===opt.value))?'bg-indigo-500 border-indigo-500 text-white':(darkMode?'border-gray-600':'border-gray-200')}`}>{opt.label}</button>)}</div></div>
                      <p className="text-xs opacity-70">{isHost?'Changes are shared with everyone in the room.':'Only the host can change game settings.'}</p>
                      <button onClick={() => setShowLobbySettings(false)} className="w-full py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold">Done</button>
                    </div>
                  </div>
                </div>
              )}
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