import { useState } from 'react';
import type { SessionConfig } from './features/table/session';
import { useTable } from './features/table/useTable';
import { HomeScreen } from './features/home/HomeScreen';
import { TableScreen } from './features/table/TableScreen';
import { HistoryScreen } from './features/review/HistoryScreen';
import { ReplayScreen } from './features/review/ReplayScreen';
import { TrainersScreen } from './features/trainers/TrainersScreen';
import type { HandRecord } from './review/recorder';
import type { TrainerName } from './trainers/progress';

type Screen = 'home' | 'table' | 'review' | 'replay' | 'trainers';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [replayRecord, setReplayRecord] = useState<HandRecord | null>(null);
  const [initialTrainer, setInitialTrainer] = useState<TrainerName | undefined>();
  const [trainerOrigin, setTrainerOrigin] = useState<'home' | 'review'>('home');
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

  function handlePractice(target: TrainerName) {
    setInitialTrainer(target);
    setTrainerOrigin('review');
    setScreen('trainers');
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
        onPractice={handlePractice}
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

  if (screen === 'trainers') {
    return (
      <TrainersScreen
        onBack={() => {
          setInitialTrainer(undefined);
          setScreen(trainerOrigin === 'review' ? 'review' : 'home');
        }}
        initialModule={initialTrainer}
      />
    );
  }

  return (
    <HomeScreen
      onStart={handleStart}
      onReview={() => setScreen('review')}
      onTrainers={() => { setTrainerOrigin('home'); setScreen('trainers'); }}
    />
  );
}

export default App;
