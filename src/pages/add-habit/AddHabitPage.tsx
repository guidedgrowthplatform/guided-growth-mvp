import { BottomNav } from '@/components/layout/BottomNav';
import { useAddHabitState } from './useAddHabitState';
import { ChoosePathPhase } from './ChoosePathPhase';
import { BeginnerCategoryPhase } from './BeginnerCategoryPhase';
import { BeginnerGoalsPhase } from './BeginnerGoalsPhase';
import { BeginnerHabitsPhase } from './BeginnerHabitsPhase';
import { BeginnerConfirmPhase } from './BeginnerConfirmPhase';
import { AdvancedInputPhase } from './AdvancedInputPhase';
import { AdvancedResultsPhase } from './AdvancedResultsPhase';
import { AdvancedEditPhase } from './AdvancedEditPhase';

export function AddHabitPage() {
  const s = useAddHabitState();

  const phase = (() => {
    switch (s.phase) {
      case 'choose-path':
        return (
          <ChoosePathPhase
            path={s.path}
            setPath={s.setPath}
            onContinue={s.handlePathContinue}
            onBack={s.handleBack}
          />
        );

      case 'beginner-category':
        return (
          <BeginnerCategoryPhase
            selectedCategory={s.selectedCategory}
            onSelectCategory={s.setSelectedCategory}
            onContinue={s.handleCategoryContinue}
            onBack={s.handleBack}
          />
        );

      case 'beginner-goals':
        if (!s.selectedCategory) return null;
        return (
          <BeginnerGoalsPhase
            selectedCategory={s.selectedCategory}
            selectedGoals={s.selectedGoals}
            toggleGoal={s.toggleGoal}
            onContinue={s.handleGoalsContinue}
            onBack={s.handleBack}
          />
        );

      case 'beginner-habits':
        if (!s.selectedCategory) return null;
        return (
          <BeginnerHabitsPhase
            selectedCategory={s.selectedCategory}
            selectedGoals={s.selectedGoals}
            selectedHabits={s.selectedHabits}
            customHabits={s.customHabits}
            toggleHabit={s.toggleHabit}
            addCustomHabit={s.addCustomHabit}
            onContinue={s.handleHabitsContinue}
            customizingHabit={s.customizingHabit}
            onSheetClose={s.handleSheetClose}
            onSheetNext={s.handleBeginnerSheetNext}
            isLastHabit={s.isLastHabit}
            onBack={s.handleBack}
          />
        );

      case 'beginner-confirm':
        return (
          <BeginnerConfirmPhase
            habitConfigs={s.habitConfigs}
            onEditHabit={s.handleEditHabit}
            onConfirm={s.handleConfirm}
            saving={s.saving}
            customizingHabit={s.customizingHabit}
            onSheetClose={s.handleSheetClose}
            onSheetNext={s.handleBeginnerSheetNext}
            isLastHabit={s.isLastHabit}
            onBack={s.handleBack}
          />
        );

      case 'advanced-input':
        return (
          <AdvancedInputPhase
            brainDumpText={s.brainDumpText}
            setBrainDumpText={s.setBrainDumpText}
            textareaRef={s.textareaRef}
            isListening={s.isListening}
            toggleVoice={s.toggleVoice}
            onDone={s.handleBrainDumpDone}
            onBack={s.handleBack}
          />
        );

      case 'advanced-results':
        return (
          <AdvancedResultsPhase
            advancedHabits={s.advancedHabits}
            onEditHabit={s.handleAdvancedEditStart}
            onConfirm={s.handleConfirm}
            saving={s.saving}
            onStartOver={s.handleAdvancedStartOver}
            onBack={s.handleBack}
          />
        );

      case 'advanced-edit':
        return (
          <AdvancedEditPhase
            editName={s.editName}
            setEditName={s.setEditName}
            editDays={s.editDays}
            setEditDays={s.setEditDays}
            editTime={s.editTime}
            setEditTime={s.setEditTime}
            onSave={s.handleAdvancedEditSave}
            onDelete={s.requestDelete}
            showDeleteModal={s.showDeleteModal}
            onConfirmDelete={s.handleAdvancedDelete}
            onCancelDelete={s.cancelDelete}
            isListening={s.isListening}
            toggleVoice={s.toggleVoice}
            onBack={s.handleBack}
          />
        );

      default:
        return null;
    }
  })();

  return (
    <>
      {phase}
      <BottomNav />
    </>
  );
}
