import React, { useCallback, useEffect, useRef, useState } from 'react';

const config = {
  apiKey: "AIzaSyAPSE2wneubHrTrCCsDn8ZEHyoszchOia0",
  authDomain: "laganea-drawing-game.firebaseapp.com",
  databaseURL: "https://laganea-drawing-game-default-rtdb.firebaseio.com",
  projectId: "laganea-drawing-game",
  storageBucket: "laganea-drawing-game.firebasestorage.app",
  messagingSenderId: "975169860070",
  appId: "1:975169860070:web:a3df9d3ffb85d4f1faa627"
};

const WORDS = {
  general: ['rainbow', 'rocket', 'castle', 'guitar', 'snowman', 'toothbrush', 'volcano', 'umbrella', 'bicycle', 'robot', 'crown', 'ladder'],
  animals: ['elephant', 'penguin', 'giraffe', 'octopus', 'butterfly', 'turtle', 'kangaroo', 'dolphin', 'hedgehog', 'flamingo'],
  food: ['pizza', 'hamburger', 'watermelon', 'taco', 'ice cream', 'sushi', 'pancakes', 'popcorn', 'birthday cake', 'carrot'],
  places: ['beach', 'school', 'airport', 'library', 'mountain', 'lighthouse', 'hospital', 'playground', 'museum', 'campground'],
  objects: ['scissors', 'backpack', 'lantern', 'key', 'camera', 'clock', 'suitcase', 'headphones', 'watering can', 'telescope'],
  popculture: ['superhero', 'alien', 'pirate', 'wizard', 'spaceship', 'dinosaur', 'mermaid', 'ninja', 'ghost', 'dragon']
};

export default function Game({ roomCode, playerName, isHost, onLeave, darkMode }) {
  const [db, setDb] = useState(null);
  const [uid, setUid] = useState(null);
  const [room, setRoom] = useState(null);
  const [guess, setGuess] = useState('');
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#222222');
  const [size, setSize] = useState(5);
  const [drawing, setDrawing] = useState(false);
  const [localPoints, setLocalPoints] = useState([]);
  const canvasRef = useRef(null);
  const lastPointRef = useRef(null);
  const endRoundLock = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [status, setStatus] = useState('Connecting to game...');

  useEffect(() => {
    let off;
    let active = true;
    (async () => {
      try {
        const [{ initializeApp, getApps, getApp }, { getDatabase, ref, onValue }, { getAuth, signInAnonymously }] = await Promise.all([
          import('firebase/app'), import('firebase/database'), import('firebase/auth')
        ]);
        const app = getApps().length ? getApp() : initializeApp(config);
        const auth = getAuth(app);
        if (!auth.currentUser) await signInAnonymously(auth);
        const database = getDatabase(app);
        if (!active) return;
        setDb(database);
        setUid(auth.currentUser.uid);
        off = onValue(ref(database, `rooms/${roomCode}`), snap => {
          if (!snap.exists()) { setStatus('This room no longer exists.'); return; }
          setRoom(snap.val());
          setStatus('');
        }, error => setStatus('Game sync error: ' + error.message));
      } catch (error) {
        setStatus('Could not connect to the game: ' + error.message);
      }
    })();
    return () => { active = false; if (off) off(); };
  }, [roomCode]);

  const players = Object.entries(room?.players || {}).map(([id, p]) => ({
    id, name: typeof p === 'string' ? p : p.name || 'Player', score: room?.scores?.[id] || 0
  }));
  const round = room?.round || 1;
  const turnIndex = room?.turnIndex || 0;
  const drawer = players[turnIndex];
  const isDrawer = drawer?.id === uid;
  const strokes = Object.values(room?.strokes || {});
  const messages = Object.entries(room?.messages || {}).map(([id, value]) => ({ id, ...value })).slice(-60);
  const solved = room?.solved || {};

  const updateRoom = async values => {
    if (!db) return;
    const { ref, update } = await import('firebase/database');
    await update(ref(db, `rooms/${roomCode}`), values);
  };

  const startRound = useCallback(async (nextRound = 1, nextTurn = 0) => {
    if (!db || !isHost || !players.length) return;
    endRoundLock.current = false;
    const pool = WORDS[room?.category] || WORDS.general;
    const word = pool[Math.floor(Math.random() * pool.length)];
    const { ref, update, remove } = await import('firebase/database');
    await Promise.all([
      update(ref(db, `rooms/${roomCode}`), {
        gameState: 'playing', round: nextRound, turnIndex: nextTurn,
        secretWord: word, deadline: Date.now() + (Number(room?.drawingTime) || 90) * 1000,
        strokes: null, messages: null, solved: null
      })
    ]);
    await remove(ref(db, `rooms/${roomCode}/strokes`));
    await remove(ref(db, `rooms/${roomCode}/messages`));
    await remove(ref(db, `rooms/${roomCode}/solved`));
  }, [db, isHost, players.length, roomCode, room?.category, room?.drawingTime]);

  useEffect(() => {
    if (!room?.deadline || room.gameState !== 'playing') return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [room?.deadline, room?.gameState]);

  useEffect(() => {
    if (!isHost || room?.gameState !== 'playing' || secondsLeft > 0 || endRoundLock.current) return;
    endRoundLock.current = true;
    const advance = async () => {
      if (round < (Number(room?.maxRounds) || 3) || turnIndex < players.length - 1) {
        const nextTurn = turnIndex + 1 < players.length ? turnIndex + 1 : 0;
        const nextRound = nextTurn === 0 ? round + 1 : round;
        await updateRoom({ gameState: 'intermission', lastWord: room?.secretWord || '', deadline: null });
        setTimeout(() => startRound(nextRound, nextTurn), 3500);
      } else {
        await updateRoom({ gameState: 'finished', deadline: null });
      }
    };
    advance().catch(error => setStatus('Could not advance round: ' + error.message));
  }, [isHost, room?.gameState, secondsLeft, round, turnIndex, players.length, room?.maxRounds, room?.secretWord, startRound]);

  const pointFromEvent = e => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const pointerDown = e => {
    if (!isDrawer || room?.gameState !== 'playing') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = pointFromEvent(e);
    lastPointRef.current = point;
    setLocalPoints([point]);
    setDrawing(true);
  };

  const pointerMove = e => {
    if (!drawing || !lastPointRef.current) return;
    const point = pointFromEvent(e);
    setLocalPoints(prev => [...prev, point]);
    lastPointRef.current = point;
  };

  const pointerUp = async () => {
    if (!drawing || localPoints.length < 1 || !db) { setDrawing(false); return; }
    setDrawing(false);
    try {
      const { ref, push, set } = await import('firebase/database');
      await set(push(ref(db, `rooms/${roomCode}/strokes`)), {
        points: localPoints, color: tool === 'eraser' ? '#ffffff' : color,
        width: tool === 'eraser' ? size * 4 : size, by: uid, at: Date.now()
      });
    } catch (error) { setStatus('Could not save drawing: ' + error.message); }
    setLocalPoints([]);
    lastPointRef.current = null;
  };

  const clearCanvas = async () => {
    if (!db || !isDrawer) return;
    const { ref, remove } = await import('firebase/database');
    await remove(ref(db, `rooms/${roomCode}/strokes`));
  };

  const submitGuess = async e => {
    e.preventDefault();
    const text = guess.trim();
    if (!text || !db || !uid) return;
    setGuess('');
    const correct = !isDrawer && text.toLowerCase() === String(room?.secretWord || '').toLowerCase();
    const { ref, push, set, update } = await import('firebase/database');
    const messageRef = push(ref(db, `rooms/${roomCode}/messages`));
    await set(messageRef, { name: playerName, text: correct ? 'guessed the word!' : text, correct, uid, at: Date.now() });
    if (correct && !solved[uid]) {
      const bonus = Math.max(100, secondsLeft * 10);
      await update(ref(db, `rooms/${roomCode}/scores`), { [uid]: (room?.scores?.[uid] || 0) + bonus });
      await update(ref(db, `rooms/${roomCode}/solved`), { [uid]: true });
      const solvedCount = Object.keys(solved).length + 1;
      if (solvedCount >= Math.max(1, players.length - 1) && isHost) {
        await updateRoom({ deadline: Date.now() + 2500 });
      }
    }
  };

  const drawStroke = (stroke, key) => {
    const pts = stroke.points || [];
    if (!pts.length) return null;
    const colorValue = stroke.color || '#222';
    const width = stroke.width || 5;
    if (pts.length === 1) return <circle key={key} cx={pts[0].x * 1000} cy={pts[0].y * 600} r={width / 2} fill={colorValue} />;
    return <polyline key={key} points={pts.map(p => `${p.x * 1000},${p.y * 600}`).join(' ')} fill="none" stroke={colorValue} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
  };

  const bg = darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 text-gray-900';
  const panel = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const currentWord = isDrawer ? room?.secretWord : null;

  if (room?.gameState === 'finished') {
    return <div className={`min-h-screen ${bg} p-6 flex items-center justify-center`}><div className={`w-full max-w-xl rounded-2xl border p-8 shadow-xl ${panel}`}><h1 className="text-3xl font-black text-indigo-600 mb-2">Game over!</h1><p className="mb-6">Great drawing. Here's the final scoreboard.</p><ol className="space-y-3 mb-8">{[...players].sort((a,b) => b.score-a.score).map((p,i)=><li key={p.id} className="flex justify-between rounded-lg bg-indigo-50 text-indigo-950 p-3"><span>{i+1}. {p.name}</span><strong>{p.score} pts</strong></li>)}</ol>{isHost && <button onClick={() => startRound(1,0)} className="rounded-lg bg-indigo-600 text-white px-5 py-3 font-bold mr-3">Play again</button>}<button onClick={onLeave} className="rounded-lg border px-5 py-3">Leave room</button></div></div>;
  }

  if (room?.gameState === 'intermission') {
    return <div className={`min-h-screen ${bg} p-6 flex items-center justify-center`}><div className={`w-full max-w-xl rounded-2xl border p-8 text-center shadow-xl ${panel}`}><div className="text-5xl mb-3">🎉</div><h1 className="text-3xl font-black mb-2">Round complete!</h1><p className="mb-6">The word was <strong>{room.lastWord}</strong>. Get ready for the next drawer.</p><div className="space-y-2 text-left mb-6">{[...players].sort((a,b)=>b.score-a.score).map(p=><div key={p.id} className="flex justify-between"><span>{p.name}</span><strong>{p.score} pts</strong></div>)}</div><p className="text-sm opacity-70">Next round starting shortly…</p></div></div>;
  }

  return <div className={`min-h-screen ${bg} p-3 md:p-6`}>
    <div className="max-w-7xl mx-auto">
      <header className={`rounded-xl border p-4 mb-4 flex flex-wrap items-center justify-between gap-3 ${panel}`}>
        <div><h1 className="text-2xl font-black text-indigo-600">LAGANEA</h1><p className="text-sm opacity-70">Room {roomCode} · Round {round}/{room?.maxRounds || 3}</p></div>
        <div className="text-center"><div className="text-sm opacity-70">{isDrawer ? 'Your secret word' : `${drawer?.name || 'The drawer'} is drawing`}</div><div className="text-xl font-bold">{isDrawer ? currentWord : (room?.secretWord ? room.secretWord.replace(/[a-z]/gi, '＿') : 'Waiting for round…')}</div></div>
        <div className={`text-3xl font-black tabular-nums ${secondsLeft <= 10 ? 'text-red-500' : 'text-indigo-600'}`}>{secondsLeft}s</div>
      </header>
      {status && <div className="mb-3 rounded-lg bg-amber-100 text-amber-900 p-3 text-sm">{status}</div>}
      {!room && <div className={`rounded-xl border p-8 ${panel}`}>Loading room state…</div>}
      {room && <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <section className={`rounded-xl border p-3 ${panel}`}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button onClick={()=>setTool('pen')} disabled={!isDrawer} className={`rounded-lg px-3 py-2 border ${tool==='pen'?'bg-indigo-600 text-white':''}`}>Pen</button>
            <button onClick={()=>setTool('eraser')} disabled={!isDrawer} className={`rounded-lg px-3 py-2 border ${tool==='eraser'?'bg-indigo-600 text-white':''}`}>Eraser</button>
            <input aria-label="Pen color" type="color" value={color} onChange={e=>setColor(e.target.value)} disabled={!isDrawer} className="h-10 w-12" />
            <input aria-label="Brush size" type="range" min="2" max="18" value={size} onChange={e=>setSize(Number(e.target.value))} disabled={!isDrawer} />
            {isDrawer && <button onClick={clearCanvas} className="ml-auto rounded-lg border px-3 py-2">Clear canvas</button>}
          </div>
          <div className="relative overflow-hidden rounded-lg border-2 border-gray-200 bg-white touch-none">
            <svg ref={canvasRef} viewBox="0 0 1000 600" preserveAspectRatio="none" className={`w-full aspect-[5/3] ${isDrawer ? 'cursor-crosshair' : 'cursor-default'}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
              {strokes.map((stroke,i)=>drawStroke(stroke,i))}
              {drawing && drawStroke({points:localPoints,color:tool==='eraser'?'#ffffff':color,width:tool==='eraser'?size*4:size},'local')}
            </svg>
          </div>
          <p className="text-xs opacity-60 mt-2">{isDrawer ? 'Draw a clue without writing letters or numbers.' : 'Guess the word in the chat. Correct guesses earn more points when time is running out.'}</p>
        </section>
        <aside className={`rounded-xl border p-3 flex flex-col min-h-[420px] ${panel}`}>
          <h2 className="font-bold text-lg mb-2">Players</h2>
          <div className="space-y-2 mb-4">{[...players].sort((a,b)=>b.score-a.score).map(p=><div key={p.id} className="flex justify-between items-center gap-2 rounded-lg bg-indigo-50 text-indigo-950 px-3 py-2"><span className="truncate">{p.name}{p.id===drawer?.id?' ✏️':''}</span><strong>{p.score}</strong></div>)}</div>
          <h2 className="font-bold text-lg mb-2">Guesses</h2>
          <div className="flex-1 min-h-32 max-h-64 overflow-y-auto space-y-2 mb-3" aria-live="polite">{messages.map(m=><div key={m.id} className={`text-sm rounded-lg p-2 ${m.correct?'bg-green-100 text-green-900':'bg-gray-100 text-gray-800'}`}><strong>{m.name}: </strong>{m.text}</div>)}</div>
          <form onSubmit={submitGuess} className="flex gap-2"><input value={guess} onChange={e=>setGuess(e.target.value)} disabled={isDrawer || Boolean(solved[uid]) || room.gameState!=='playing'} placeholder={isDrawer?'You are drawing…':solved[uid]?'You got it!':'Type your guess'} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-gray-900" /><button disabled={isDrawer || !guess.trim() || Boolean(solved[uid])} className="rounded-lg bg-indigo-600 text-white px-4 font-bold disabled:opacity-40">Send</button></form>
          {isHost && room.gameState==='setup' && <button onClick={()=>startRound(1,0)} className="mt-3 rounded-lg bg-indigo-600 text-white px-4 py-3 font-bold">Start game</button>}
          <button onClick={onLeave} className="mt-3 rounded-lg border px-4 py-2">Leave room</button>
        </aside>
      </div>}
    </div>
  </div>;
}
