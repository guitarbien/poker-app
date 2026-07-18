import { useState } from 'react';
import type { EquityGuessPayload } from '../../trainers/equityGuess';
import { generateEquityGuess } from '../../trainers/equityGuess';
import type { HandReadingPayload } from '../../trainers/handReading';
import { generateHandReading } from '../../trainers/handReading';
import type { PotOddsPayload } from '../../trainers/potOdds';
import { generatePotOdds } from '../../trainers/potOdds';
import type { PreflopRangePayload } from '../../trainers/preflopRange';
import { generatePreflopRange } from '../../trainers/preflopRange';
import type { TrainerName } from '../../trainers/progress';
import type { QuizQuestion } from '../../trainers/types';
import { EquityGuessQuiz } from './EquityGuessQuiz';
import { HandReadingQuiz } from './HandReadingQuiz';
import { PotOddsQuiz } from './PotOddsQuiz';
import { PreflopRangeQuiz } from './PreflopRangeQuiz';
import { QuizShell } from './QuizShell';
import { TrainerMenu } from './TrainerMenu';

type TrainerState =
  | { view: 'menu' }
  | { view: 'quiz'; name: TrainerName; mode: 'practice' | 'review' };

// UI 出題用 Math.random（spec：rng UI 用 Math.random）
const GENERATORS: Record<TrainerName, () => QuizQuestion<unknown>> = {
  handReading: () => generateHandReading(Math.random),
  potOdds: () => generatePotOdds(Math.random),
  preflopRange: () => generatePreflopRange(Math.random),
  equityGuess: () => generateEquityGuess(Math.random),
};

function renderQuizBody(
  name: TrainerName,
  q: QuizQuestion<unknown>,
  onAnswer: (correct: boolean) => void,
  phase: 'answering' | 'feedback',
) {
  switch (name) {
    case 'handReading':
      return <HandReadingQuiz question={q as QuizQuestion<HandReadingPayload>} onAnswer={onAnswer} phase={phase} />;
    case 'potOdds':
      return <PotOddsQuiz question={q as QuizQuestion<PotOddsPayload>} onAnswer={onAnswer} phase={phase} />;
    case 'preflopRange':
      return <PreflopRangeQuiz question={q as QuizQuestion<PreflopRangePayload>} onAnswer={onAnswer} phase={phase} />;
    case 'equityGuess':
      return <EquityGuessQuiz question={q as QuizQuestion<EquityGuessPayload>} onAnswer={onAnswer} phase={phase} />;
  }
}

interface TrainersScreenProps {
  onBack: () => void;
  initialModule?: TrainerName;
}

export function TrainersScreen({ onBack, initialModule }: TrainersScreenProps) {
  const [state, setState] = useState<TrainerState>(
    initialModule
      ? { view: 'quiz', name: initialModule, mode: 'practice' }
      : { view: 'menu' },
  );

  if (state.view === 'quiz') {
    const { name, mode } = state;
    // ponytail: 當 initialModule 存在（由儀表板直入），退出直接回 origin screen
    const handleExit = initialModule ? onBack : () => setState({ view: 'menu' });
    return (
      <QuizShell
        key={`${name}-${mode}`}
        name={name}
        mode={mode}
        generate={GENERATORS[name]}
        renderBody={(q, onAnswer, phase) => renderQuizBody(name, q, onAnswer, phase)}
        onExit={handleExit}
      />
    );
  }

  return (
    <TrainerMenu
      onStart={(name, mode) => setState({ view: 'quiz', name, mode })}
      onBack={onBack}
    />
  );
}
