import { useState } from 'react';
import type { SessionConfig } from './features/table/session';
import { useTable } from './features/table/useTable';
import { HomeScreen } from './features/home/HomeScreen';
import { TableScreen } from './features/table/TableScreen';

function App() {
  const [screen, setScreen] = useState<'home' | 'table'>('home');
  const table = useTable();

  function handleStart(config: SessionConfig) {
    table.start(config);
    setScreen('table');
  }

  function handleExit() {
    table.exit();
    setScreen('home');
  }

  if (screen === 'table') {
    return (
      <TableScreen
        state={table.state}
        onAction={table.act}
        onNextHand={table.nextHand}
        onRebuyAndNext={table.rebuyAndNext}
        onExit={handleExit}
      />
    );
  }

  return <HomeScreen onStart={handleStart} />;
}

export default App;
