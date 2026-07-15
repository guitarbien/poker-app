import { useState } from 'react';
import type { SessionConfig } from './features/table/session';
import { useTable } from './features/table/useTable';
import { HomeScreen } from './features/home/HomeScreen';
import { TableScreen } from './features/table/TableScreen';

function App() {
  const [screen, setScreen] = useState<'home' | 'table'>('home');
  const { state, dispatch } = useTable();

  function handleStart(config: SessionConfig) {
    dispatch({ type: 'start', config });
    setScreen('table');
  }

  function handleExit() {
    dispatch({ type: 'exit' });
    setScreen('home');
  }

  if (screen === 'table') {
    return (
      <TableScreen
        state={state}
        onAction={(action) => dispatch({ type: 'humanAction', action })}
        onNextHand={() => dispatch({ type: 'nextHand' })}
        onRebuyAndNext={() => dispatch({ type: 'humanRebuyAndNext' })}
        onExit={handleExit}
      />
    );
  }

  return <HomeScreen onStart={handleStart} />;
}

export default App;
