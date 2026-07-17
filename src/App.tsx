import { useState } from 'react';
import type { SessionConfig } from './features/table/session';
import { useTable } from './features/table/useTable';
import { HomeScreen } from './features/home/HomeScreen';
import { TableScreen } from './features/table/TableScreen';
import { HistoryScreen } from './features/review/HistoryScreen';
import { ReplayScreen } from './features/review/ReplayScreen';
import type { HandRecord } from './review/recorder';

type Screen = 'home' | 'table' | 'review' | 'replay';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [replayRecord, setReplayRecord] = useState<HandRecord | null>(null);
  const table = useTable();

  function handleStart(config: SessionConfig) {
    table.start(config);
    setScreen('table');
  }

  function handleExit() {
    table.exit();
    setScreen('home');
  }

  function handleReplay(record: HandRecord) {
    setReplayRecord(record);
    setScreen('replay');
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

  if (screen === 'review') {
    return (
      <HistoryScreen
        onBack={() => setScreen('home')}
        onReplay={handleReplay}
      />
    );
  }

  if (screen === 'replay' && replayRecord) {
    return (
      <ReplayScreen
        record={replayRecord}
        onBack={() => setScreen('review')}
      />
    );
  }

  return <HomeScreen onStart={handleStart} onReview={() => setScreen('review')} />;
}

export default App;
